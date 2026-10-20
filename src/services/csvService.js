const fs = require('fs');
const csv = require('csv-parser');
const db = require('../config/db');
const JournalNotificationModel = require('../models/journalNotificationModel');

/**
 * SERVICE : Traitement du fichier CSV AeroPub pour le schéma base_v3.sql
 */
class CsvService {
  /**
   * Lit, analyse et insère le CSV dans PostgreSQL en respectant les relations de base_v3.sql
   * @param {string} filePath - Chemin vers le fichier CSV temporaire
   */

  // Niveau 0 : Détection automatique du séparateur (, ou ; ou \t)
  static detectedDelimiter(firstChunk) {
    const firstLine = firstChunk.split(/\r?\n/)[0] || firstChunk;
    const semicolonsLine = (firstLine.match(/;/g) || []).length;
    const commasLine = (firstLine.match(/,/g) || []).length;
    const tabsLine = (firstLine.match(/\t/g) || []).length;

    if (semicolonsLine > 0 && semicolonsLine >= commasLine && semicolonsLine >= tabsLine) return ';';
    if (tabsLine > 0 && tabsLine >= commasLine && tabsLine >= semicolonsLine) return '\t';
    if (commasLine > 0 && commasLine >= semicolonsLine) return ',';

    const commas = (firstChunk.match(/,/g) || []).length;
    const semicolons = (firstChunk.match(/;/g) || []).length;
    const tabs = (firstChunk.match(/\t/g) || []).length;
    if (semicolons > commas && semicolons > tabs) return ';';
    if (tabs > commas && tabs > semicolons) return '\t';
    return ',';
  }

  /**
   * Analyse la colonne Contacts au format Tuple :
   * Ex: [(Email, andry.r@airmad.mg, true), (Téléphone, +261340000000, false)]
   */
  static parseContactsTuple(rawContactsStr) {
    if (!rawContactsStr || !rawContactsStr.trim() || rawContactsStr.trim() === '[]') {
      return [];
    }

    const contacts = [];
    const tupleRegex = /\(([^)]+)\)/g;
    let match;
    const cleanStr = (s) => (s || '').replace(/^['"]+|['"]+$/g, '').trim();

    while ((match = tupleRegex.exec(rawContactsStr)) !== null) {
      const content = match[1].trim();
      if (!content) continue;

      const parts = content.split(',').map(cleanStr);
      if (parts.length >= 2) {
        const nom = parts[0];     // "Email", "Téléphone", etc. -> colonne nom_contact
        const valeur = parts[1];  // "andry.r@airmad.mg", "+261...", etc. -> colonne valeur
        let estPrincipal = contacts.length === 0;

        if (parts.length >= 3) {
          estPrincipal = /^(true|1|oui|yes)$/i.test(parts[2]);
        }

        if (valeur) {
          contacts.push({ nom: nom || 'Contact', valeur, estPrincipal });
        }
      } else if (parts.length === 1 && parts[0]) {
        contacts.push({ nom: 'Contact', valeur: parts[0], estPrincipal: contacts.length === 0 });
      }
    }

    return contacts;
  }

  static parseSupportsList(rawSupportsStr) {
    if (!rawSupportsStr || !rawSupportsStr.trim() || rawSupportsStr.trim() === '[]') {
      return [];
    }
    const cleaned = rawSupportsStr.replace(/[\[\]]/g, '').trim();
    if (!cleaned) return [];
    return cleaned
      .split(/[,;]+/)
      .map(s => s.trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(Boolean);
  }

  /**
   * Vérifie si un support physique est déjà réservé/occupé sur une période chevauchante.
   * Utilise directement la connexion transactionnelle clientDb du CSV.
   */
  static async checkSupportConflict(clientDb, { supportRef, excludeAboRef, dateDebut, dateFin }) {
    if (!supportRef || !dateDebut || !dateFin) return null;

    const query = `
      SELECT 
        a.reference, 
        a.date_debut, 
        a.date_echeance, 
        cl.raison_sociale
      FROM Abonnement a
      JOIN Abonnement_Support asup ON asup.id_abonnement = a.reference
      LEFT JOIN Client cl ON cl.id = a.id_client
      LEFT JOIN LATERAL (
        SELECT tsa.nom_statut
        FROM Statut_Abonnement sa
        JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
        WHERE sa.id_abonnement = a.reference
        ORDER BY sa.id DESC
        LIMIT 1
      ) st ON true
      WHERE asup.reference_support = $1
        AND ($2::text IS NULL OR a.reference != $2)
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%archiv%'
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%r_sili%'
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%resili%'
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%annul%'
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%expir%'
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%renouv%'
        AND a.date_debut < $4
        AND a.date_echeance > $3
      LIMIT 1
    `;

    const resultatConflit = await clientDb.query(query, [
      supportRef,
      excludeAboRef || null,
      dateDebut,
      dateFin
    ]);

    if (resultatConflit.rows.length > 0) {
      return resultatConflit.rows[0];
    }
    return null;
  }

  /**
   * Met à jour l'historique physique Etat_Support pour chaque support lié au contrat.
   * Exécuté directement dans la transaction clientDb.
   */
  static async cascadeStatutToSupports(clientDb, { refAbo, statutNom, dateDebut, dateEcheance, supportsList }) {
    if (!supportsList || supportsList.length === 0) return;

    const cleanStatut = String(statutNom || 'actif').trim().toLowerCase();
    let targetEtatNom = 'disponible';
    if (cleanStatut.includes('actif') || cleanStatut.includes('renouv') || cleanStatut.includes('echu') || cleanStatut.includes('échu')) {
      targetEtatNom = 'occupé';
    } else if (cleanStatut === 'brouillon' || cleanStatut.includes('valid')) {
      targetEtatNom = 'réservé';
    } else if (cleanStatut.includes('maint')) {
      targetEtatNom = 'en maintenance';
    }

    const resEtat = await clientDb.query(
      'SELECT id FROM Type_Etat_Support WHERE LOWER(nom_etat) = LOWER($1) LIMIT 1',
      [targetEtatNom]
    );
    const targetEtatId = resEtat.rows[0]?.id || (targetEtatNom === 'occupé' ? 3 : 1);

    for (const supRef of supportsList) {
      // 1. Clôturer l'état ouvert précédent
      await clientDb.query(`
        UPDATE Etat_Support 
        SET date_fin = CURRENT_TIMESTAMP 
        WHERE reference_support = $1 AND (date_fin IS NULL OR date_fin > CURRENT_TIMESTAMP)
      `, [supRef]);

      // 2. Insérer le nouvel état physique avec les dates réelles du contrat
      await clientDb.query(`
        INSERT INTO Etat_Support (reference_support, id_type_etat, date_debut, date_fin, observation)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        supRef,
        targetEtatId,
        dateDebut,
        dateEcheance,
        `[Import CSV] Contrat ${refAbo} : ${targetEtatNom} (Statut: ${statutNom})`
      ]);
    }
  }

  static async processInfrastructureCsv(filePath) {
    // NIVEAU 0 : FORMAT & VÉRIFICATION DU FICHIER
    if (!fs.existsSync(filePath)) {
      throw new Error("Le fichier temporaire n'a pas été trouvé sur le serveur.");
    }

    const fileContentSample = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).slice(0, 4096);
    if (!fileContentSample.trim()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Le fichier CSV téléversé est complètement vide.");
    }

    const separator = this.detectedDelimiter(fileContentSample);
    const rawRows = [];

    // Lecture du flux CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csv({ separator, mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
        .on('data', (row) => rawRows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rawRows.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Aucune ligne de donnée exploitable n'a été détectée dans le fichier.");
    }

    // NIVEAU 1 : STRUCTURE & EN-TÊTES ATTENDUS
    const firstRow = rawRows[0];
    const getVal = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
      return '';
    };

    const hasRef = Object.keys(firstRow).some(k => /^(reference|ref)$/i.test(k));
    const hasZone = Object.keys(firstRow).some(k => /^(zone|nom_zone|zone_terminal|localisation)$/i.test(k));

    if (!hasRef || !hasZone) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error(
        `Structure invalide : Les colonnes minimales obligatoires 'Reference' et 'Zone' sont introuvables. Séparateur détecté : '${separator === '\t' ? 'Tabulation' : separator}'.`
      );
    }

    // NIVEAUX 2 & 3 : TRANSACTION, DOUBLONS ET SAVEPOINTS
    const clientDb = await db.pool.connect();
    const refsInFile = new Set();
    const rapport = {
      totalLignes: rawRows.length,
      lignesImportees: 0,
      doublonsInternes: 0,
      doublonsBdd: 0,
      erreursCount: 0,
      erreurs: []
    };

    try {

      await clientDb.query('BEGIN');

      // 0. Synchronisation automatique des séquences PostgreSQL sur MAX(id)
      // Empêche définitivement les collisions de clés primaires SERIAL
      const tablesToSync = [
        'aeroport',
        'perimetre',
        'zone_terminal',
        'categorie_support',
        'type_support',
        'type_etat_support',
        'etat_support'
      ];
      for (const tbl of tablesToSync) {
        try {
          await clientDb.query(`
            SELECT setval(
              pg_get_serial_sequence('${tbl}', 'id'),
              COALESCE((SELECT MAX(id) FROM ${tbl}), 1),
              (SELECT MAX(id) FROM ${tbl}) IS NOT NULL
            )
          `);
        } catch (seqErr) {
          console.warn(`[CSV SYNC] Avertissement séquence pour ${tbl}:`, seqErr.message);
        }
      }

      // Helper pour trouver ou insérer une entité de référence de façon sécurisée
      const findOrCreateRef = async (table, colName, value) => {
        const existing = await clientDb.query(
          `SELECT id FROM ${table} WHERE LOWER(${colName}) = LOWER($1) LIMIT 1`,
          [value]
        );
        if (existing.rows.length > 0) {
          return existing.rows[0].id;
        }
        const inserted = await clientDb.query(
          `INSERT INTO ${table} (${colName}) VALUES ($1) RETURNING id`,
          [value]
        );
        return inserted.rows[0].id;
      };

      // Pré-charger les références existantes en BDD pour optimiser les performances
      const existingRefsRes = await clientDb.query('SELECT reference FROM Support');
      const refsInBdd = new Set(existingRefsRes.rows.map(r => r.reference.toUpperCase()));

      for (let i = 0; i < rawRows.length; i++) {
        const ligneNum = i + 2;
        const row = rawRows[i];

        const ref = getVal(row, 'Reference', 'reference', 'Ref', 'ref');
        const zoneNom = getVal(row, 'Zone', 'zone', 'Zone_Terminal', 'nom_zone', 'Localisation') || 'Zone Générale';
        const aeroNom = getVal(row, 'Aeroport', 'aeroport', 'nom_aeroport') || 'Ivato';
        const periNom = getVal(row, 'Perimetre', 'perimetre', 'nom_perimetre') || 'National';
        const catNom = getVal(row, 'Categorie', 'categorie', 'Categorie_Support', 'nom_categorie') || 'Statique';
        const typeSupportNom = getVal(row, 'Type_Support', 'type_support', 'Type', 'type', 'nom_type_support') || 'Standard';
        const caracteristiques = getVal(row, 'Caracteristiques', 'caracteristiques', 'Format', 'format', 'Dimensions');
        const statutNom = getVal(row, 'Statut', 'statut', 'Etat', 'etat', 'Type_Etat') || 'Disponible';
        const observation = getVal(row, 'Observation', 'observation', 'Commentaire');

        // Isolation ligne par ligne via SAVEPOINT
        await clientDb.query(`SAVEPOINT row_${ligneNum}`);

        try {
          // --- Niveau 1 : Validation de la ligne ---
          if (!ref) {
            throw new Error("La colonne 'Reference' est vide pour cette ligne.");
          }
          if (ref.length > 50) {
            throw new Error(`La référence '${ref}' dépasse la longueur maximale de 50 caractères.`);
          }

          const refUpper = ref.toUpperCase();

          // --- Niveau 2 : Détection des doublons internes ---
          if (refsInFile.has(refUpper)) {
            rapport.doublonsInternes++;
            throw new Error(`Doublon interne : la référence '${ref}' apparaît plusieurs fois dans ce fichier CSV.`);
          }
          refsInFile.add(refUpper);

          // --- Niveau 2 : Détection des doublons en BDD ---
          if (refsInBdd.has(refUpper)) {
            rapport.doublonsBdd++;
            rapport.erreurs.push({
              ligne: ligneNum,
              reference: ref,
              motif: `Doublon ignoré : Le support '${ref}' existe déjà dans la base de données.`,
              type: 'doublon'
            });
            // Décision : On ignore l'insertion sans bloquer l'import
            await clientDb.query(`RELEASE SAVEPOINT row_${ligneNum}`);
            continue;
          }

          // --- Niveau 3 : Insertion des 8 tables d'infrastructure ---
          // 1. Aeroport
          const aeroId = await findOrCreateRef('Aeroport', 'nom', aeroNom);

          // 2. Perimetre
          const periId = await findOrCreateRef('Perimetre', 'nom', periNom);

          // 3. Zone_Terminal
          let zoneId;
          const resZone = await clientDb.query(`
            SELECT id FROM Zone_Terminal 
            WHERE LOWER(nom_zone) = LOWER($1) AND id_aeroport = $2 AND id_perimetre = $3
            LIMIT 1
          `, [zoneNom, aeroId, periId]);

          if (resZone.rows.length > 0) {
            zoneId = resZone.rows[0].id;
          } else {
            const insZone = await clientDb.query(`
              INSERT INTO Zone_Terminal (nom_zone, id_aeroport, id_perimetre)
              VALUES ($1, $2, $3) RETURNING id
            `, [zoneNom, aeroId, periId]);
            zoneId = insZone.rows[0].id;
          }

          // 4. Categorie_Support
          const catId = await findOrCreateRef('Categorie_Support', 'nom', catNom);

          // 5. Type_Support
          const tsId = await findOrCreateRef('Type_Support', 'nom', typeSupportNom);

          // 6. Type_Etat_Support
          const idTypeEtat = await findOrCreateRef('Type_Etat_Support', 'nom_etat', statutNom);

          // 7. Support
          await clientDb.query(`
            INSERT INTO Support (reference, id_zone, id_categorie, id_type, caracteristiques)
            VALUES ($1, $2, $3, $4, $5)
          `, [ref, zoneId, catId, tsId, caracteristiques || null]);

          // 8. Etat_Support (Création de l'historique initial)
          await clientDb.query(`
            INSERT INTO Etat_Support (reference_support, id_type_etat, date_debut, observation)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
          `, [ref, idTypeEtat, observation || 'Initialisé par import CSV']);

          // Succès de la ligne
          refsInBdd.add(refUpper);
          rapport.lignesImportees++;
          await clientDb.query(`RELEASE SAVEPOINT row_${ligneNum}`);

        } catch (error) {
          await clientDb.query(`ROLLBACK TO SAVEPOINT row_${ligneNum}`);
          rapport.erreursCount++;
          rapport.erreurs.push({
            ligne: ligneNum,
            reference: ref || 'INCONNUE',
            motif: error.message
          });
        }
      }

      await clientDb.query('COMMIT');

      await JournalNotificationModel.logAction({
        categorie_action: 'IMPORT',
        entite_concernee: 'SUPPORT',
        reference_entite: 'CSV_INFRASTRUCTURE',
        valeur_apres: {
          totalLignes: rapport.totalLignes,
          lignesImportees: rapport.lignesImportees,
          doublonsInternes: rapport.doublonsInternes,
          doublonsBdd: rapport.doublonsBdd,
          erreursCount: rapport.erreursCount
        },
        message_notification: `Import de ${rapport.lignesImportees} ligne(s) d'emplacement(s) / support(s) (sur ${rapport.totalLignes} ligne(s) traitée(s)).`
      });

      return rapport;

    } catch (error) {
      await clientDb.query('ROLLBACK');
      throw error;
    } finally {
      clientDb.release();
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) { }
      }
    }
  }

  static async processClientCsv(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error("Le fichier temporaire n'a pas été trouvé sur le serveur.");
    }

    const fileContentSample = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).slice(0, 4096);
    if (!fileContentSample.trim()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Le fichier CSV téléversé est complètement vide.");
    }

    const separator = this.detectedDelimiter(fileContentSample);
    const rawRows = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csv({ separator, mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
        .on('data', (row) => rawRows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rawRows.length === 0) {
      if (fs.existsSync(filePath)) fs.unlink(filePath);
      throw new Error("Aucune ligne de donnée exploitable n'a été détectée dans le fichier.");
    }

    const firstRow = rawRows[0];
    const getVal = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
      return '';
    };

    const hasRaisonSociale = Object.keys(firstRow).some(k =>
      /^(raison_sociale|raisonsociale|entreprise|societe|client|nom_client)$/i.test(k)
    );

    if (!hasRaisonSociale) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error(
        `Structure invalide : La colonne obligatoire 'Raison_Sociale' est introuvable. Séparateur détecté : '${separator === '\t' ? 'Tabulation' : separator}'.`
      );
    }

    const clientDb = await db.pool.connect();
    const rapport = {
      totalLignes: rawRows.length,
      clientsCrees: 0,
      contactsCrees: 0,
      doublonsInternes: 0,
      doublonsBdd: 0,
      erreursCount: 0,
      erreurs: []
    };

    try {
      await clientDb.query('BEGIN');

      // 0. Synchronisation des séquences sur MAX(id)
      const tablesToSync = ['client', 'contact'];
      for (const tbl of tablesToSync) {
        try {
          await clientDb.query(`
            SELECT setval(
              pg_get_serial_sequence('${tbl}', 'id'),
              COALESCE((SELECT MAX(id) FROM "${tbl}"), 1),
              (SELECT MAX(id) FROM "${tbl}") IS NOT NULL
            )
          `);
        } catch (seqErr) {
          console.warn(`[CSV SYNC CLIENT] Avertissement séquence pour ${tbl}:`, seqErr.message);
        }
      }

      // Pré-charger les clients existants : Map(UPPER(raison_sociale) -> id)
      const existingClientsRes = await clientDb.query('SELECT id, UPPER(TRIM(raison_sociale)) AS rs FROM Client');
      const clientMap = new Map();
      for (const r of existingClientsRes.rows) {
        clientMap.set(r.rs, r.id);
      }

      // Pré-charger les contacts existants : Set("${id_client}:${UPPER(valeur)}")
      const existingContactsRes = await clientDb.query('SELECT id_client, UPPER(TRIM(valeur)) AS val FROM Contact WHERE valeur IS NOT NULL');
      const contactsInBdd = new Set(existingContactsRes.rows.map(r => `${r.id_client}:${r.val}`));
      const contactsInFile = new Set();

      for (let i = 0; i < rawRows.length; i++) {
        const ligneNum = i + 2;
        const row = rawRows[i];

        const raisonSociale = getVal(row, 'Raison_Sociale', 'raison_sociale', 'Entreprise', 'Societe', 'Client', 'Nom_Client');
        const adressePostale = getVal(row, 'Adresse_Postale', 'adresse_postale', 'Adresse', 'adresse');
        let adresseFacturation = getVal(row, 'Adresse_Facturation', 'adresse_facturation');
        if (!adresseFacturation || /^(m[êe]me\s*adresse|identique|idem)$/i.test(adresseFacturation)) {
          adresseFacturation = adressePostale;
        }
        const etatClient = getVal(row, 'Etat_Client', 'etat_client', 'Statut', 'statut', 'Etat') || 'Actif';

        await clientDb.query(`SAVEPOINT row_${ligneNum}`);

        try {
          // Niveau 1 : Validation de la ligne
          if (!raisonSociale) {
            throw new Error("La colonne 'Raison_Sociale' est vide pour cette ligne.");
          }
          if (raisonSociale.length > 150) {
            throw new Error(`La raison sociale '${raisonSociale}' dépasse la limite de 150 caractères.`);
          }

          const rsUpper = raisonSociale.toUpperCase();
          let clientId;
          let isNewClient = false;

          // Niveau 2 & 3 : Client "Find or Create" (permet les lignes multiples pour un même client)
          if (clientMap.has(rsUpper)) {
            clientId = clientMap.get(rsUpper);
          } else {
            const insClient = await clientDb.query(`
              INSERT INTO Client (raison_sociale, adresse_postale, adresse_facturation, etat_client)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, [raisonSociale, adressePostale || null, adresseFacturation || null, etatClient]);

            clientId = insClient.rows[0].id;
            clientMap.set(rsUpper, clientId);
            rapport.clientsCrees++;
            isNewClient = true;
          }

          // Extraction des contacts directement depuis la colonne 'Contacts'
          const rawContacts = getVal(row, 'Contacts', 'contacts', 'Contact', 'contact');
          const contactsToInsert = CsvService.parseContactsTuple(rawContacts);

          for (const c of contactsToInsert) {
            if (!c.valeur) continue;

            const contactKey = `${clientId}:${c.valeur.toUpperCase()}`;

            // Doublon interne au CSV pour ce client
            if (contactsInFile.has(contactKey)) {
              rapport.doublonsInternes++;
              rapport.erreurs.push({
                ligne: ligneNum,
                reference: `${raisonSociale} (${c.valeur})`,
                motif: `Doublon interne : Ce contact apparaît plusieurs fois dans le fichier CSV.`,
                type: 'doublon'
              });
              continue;
            }
            contactsInFile.add(contactKey);

            // Doublon en base de données pour ce client
            if (contactsInBdd.has(contactKey)) {
              rapport.doublonsBdd++;
              rapport.erreurs.push({
                ligne: ligneNum,
                reference: `${raisonSociale} (${c.valeur})`,
                motif: `Doublon ignoré : Ce contact existe déjà pour ce client en base de données.`,
                type: 'doublon'
              });
              continue;
            }

            // Insertion dans la table Contact : (id_client, nom_contact, valeur, est_principal)
            await clientDb.query(`
              INSERT INTO Contact (id_client, nom_contact, valeur, est_principal)
              VALUES ($1, $2, $3, $4)
            `, [clientId, c.nom, c.valeur, c.estPrincipal]);

            contactsInBdd.add(contactKey);
            rapport.contactsCrees++;
          }

          await clientDb.query(`RELEASE SAVEPOINT row_${ligneNum}`);

        } catch (error) {
          await clientDb.query(`ROLLBACK TO SAVEPOINT row_${ligneNum}`);
          rapport.erreursCount++;
          rapport.erreurs.push({
            ligne: ligneNum,
            reference: raisonSociale || 'INCONNUE',
            motif: error.message
          });
        }

      }
      await clientDb.query('COMMIT');

      await JournalNotificationModel.logAction({
        categorie_action: 'IMPORT',
        entite_concernee: 'CLIENT',
        reference_entite: 'CSV_CLIENTS',
        valeur_apres: {
          totalLignes: rapport.totalLignes,
          clientsCrees: rapport.clientsCrees,
          contactsCrees: rapport.contactsCrees,
          doublonsInternes: rapport.doublonsInternes,
          doublonsBdd: rapport.doublonsBdd,
          erreursCount: rapport.erreursCount
        },
        message_notification: `Import de ${rapport.clientsCrees} ligne(s) de client(s) (sur ${rapport.totalLignes} ligne(s) traitée(s)).`
      });

      return rapport;

    } catch (error) {
      await clientDb.query('ROLLBACK');
      throw error;
    }
    finally {
      clientDb.release();
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) { }
      }
    }

  }

  static async processAbonnementCsv(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error("Le fichier temporaire n'a pas été trouvé sur le serveur.");
    }
    const fileContentSample = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).slice(0, 4096);
    if (!fileContentSample.trim()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Le fichier CSV téléversé est complètement vide.");
    }
    const separator = this.detectedDelimiter(fileContentSample);
    const rawRows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csv({ separator, mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
        .on('data', (row) => rawRows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    if (rawRows.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Aucune ligne de donnée exploitable n'a été détectée dans le fichier.");
    }
    const firstRow = rawRows[0];
    const getVal = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
      return '';
    };

    const hasRef = Object.keys(firstRow).some(k => /^(reference_abo|reference|ref_abo|ref)$/i.test(k));
    const hasClient = Object.keys(firstRow).some(k => /^(client|raison_sociale|entreprise)$/i.test(k));
    if (!hasRef || !hasClient) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error(
        `Structure invalide : Les colonnes obligatoires 'Reference_Abo' et 'Client' sont introuvables. Séparateur détecté : '${separator === '\t' ? 'Tabulation' : separator}'.`
      );
    }
    const clientDb = await db.pool.connect();
    const abosInFile = new Set();
    const rapport = {
      totalLignes: rawRows.length,
      abonnementsCrees: 0,
      supportsLies: 0,
      doublonsInternes: 0,
      doublonsBdd: 0,
      erreursCount: 0,
      erreurs: [],
      doublonsDetails: []
    };
    try {
      await clientDb.query('BEGIN');

      const tablesToSync = ['type_statut_abonnement', 'statut_abonnement'];
      for (const tbl of tablesToSync) {
        try {
          await clientDb.query(`
            SELECT setval(
              pg_get_serial_sequence('${tbl}', 'id'),
              COALESCE((SELECT MAX(id) FROM "${tbl}"), 1),
              (SELECT MAX(id) FROM "${tbl}") IS NOT NULL
            )
          `);
        } catch (seqErr) {
          console.warn(`[CSV SYNC ABO] Avertissement séquence pour ${tbl}:`, seqErr.message);
        }
      }

      const existingAbosRes = await clientDb.query('SELECT reference FROM Abonnement');
      const abosInBdd = new Set(existingAbosRes.rows.map(r => r.reference.toUpperCase()));

      const existingSupportsRes = await clientDb.query('SELECT reference FROM Support');
      const supportsInBdd = new Set(existingSupportsRes.rows.map(r => r.reference.toUpperCase()));
      for (let i = 0; i < rawRows.length; i++) {
        const ligneNum = i + 2;
        const row = rawRows[i];
        const refAbo = getVal(row, 'Reference_Abo', 'reference_abo', 'Reference', 'ref_abo', 'Ref');
        const clientNom = getVal(row, 'Client', 'client', 'Raison_Sociale', 'entreprise');
        const commercialEmail = getVal(row, 'Email_Commercial', 'email_commercial', 'Commercial', 'commercial');
        const annonceur = getVal(row, 'Annonceur', 'annonceur', 'Campagne', 'campagne') || 'Campagne Standard';
        const tarifRaw = getVal(row, 'Tarif', 'tarif', 'Montant', 'montant', 'Prix');
        const periodiciteRaw = getVal(row, 'Periodicite', 'periodicite', 'Périodicite', 'périodicite', 'Periodicite_Paiement', 'periodicite_paiement', 'Periode', 'periode');
        const dateDebutRaw = getVal(row, 'Date_Debut', 'date_debut', 'Debut');
        const dateEcheanceRaw = getVal(row, 'Date_Echeance', 'date_echeance', 'Echeance', 'Fin');
        const statutNom = getVal(row, 'Statut', 'statut', 'Etat') || 'actif';
        const rawSupports = getVal(row, 'Supports', 'supports', 'Support', 'support');
        await clientDb.query(`SAVEPOINT row_${ligneNum}`);
        try {

          if (!refAbo) throw new Error("La colonne 'Reference_Abo' est vide pour cette ligne.");
          if (!clientNom) throw new Error("La colonne 'Client' est vide pour cette ligne.");
          if (!dateDebutRaw || isNaN(Date.parse(dateDebutRaw))) throw new Error(`Date de début invalide : '${dateDebutRaw}'.`);
          if (!dateEcheanceRaw || isNaN(Date.parse(dateEcheanceRaw))) throw new Error(`Date d'échéance invalide : '${dateEcheanceRaw}'.`);
          if (new Date(dateEcheanceRaw) < new Date(dateDebutRaw)) {
            throw new Error(`La date d'échéance (${dateEcheanceRaw}) ne peut pas être antérieure à la date de début (${dateDebutRaw}).`);
          }
          const tarifClean = parseFloat(String(tarifRaw || '0').replace(/[\s\u00A0A-Za-z€$Ar]/g, '').replace(',', '.'));
          if (isNaN(tarifClean) || tarifClean < 0) {
            throw new Error(`Le montant du tarif '${tarifRaw}' est invalide.`);
          }
          const refUpper = refAbo.toUpperCase();

          if (abosInFile.has(refUpper)) {
            rapport.doublonsInternes++;
            throw new Error(`Doublon interne : la référence contrat '${refAbo}' apparaît plusieurs fois.`);
          }
          abosInFile.add(refUpper);

          if (abosInBdd.has(refUpper)) {
            rapport.doublonsBdd++;
            rapport.erreurs.push({
              ligne: ligneNum,
              reference: refAbo,
              motif: `Doublon ignoré : Le contrat '${refAbo}' existe déjà dans la base de données.`,
              type: 'doublon'
            });
            await clientDb.query(`RELEASE SAVEPOINT row_${ligneNum}`);
            continue;
          }

          let clientId;
          const resClient = await clientDb.query('SELECT id FROM Client WHERE LOWER(raison_sociale) = LOWER($1) LIMIT 1', [clientNom]);
          if (resClient.rows.length > 0) {
            clientId = resClient.rows[0].id;
          } else {
            const insClient = await clientDb.query('INSERT INTO Client (raison_sociale) VALUES ($1) RETURNING id', [clientNom]);
            clientId = insClient.rows[0].id;
          }

          let commercialId;
          if (commercialEmail) {
            const resCom = await clientDb.query('SELECT id FROM Utilisateur WHERE LOWER(email) = LOWER($1) LIMIT 1', [commercialEmail]);
            if (resCom.rows.length > 0) commercialId = resCom.rows[0].id;
          }
          if (!commercialId) {
            const resDefCom = await clientDb.query('SELECT id FROM Utilisateur ORDER BY id ASC LIMIT 1');
            commercialId = resDefCom.rows[0]?.id || 1;
          }

          let idTypeStatut;
          const resStatut = await clientDb.query('SELECT id FROM Type_Statut_Abonnement WHERE LOWER(nom_statut) = LOWER($1) LIMIT 1', [statutNom]);
          if (resStatut.rows.length > 0) {
            idTypeStatut = resStatut.rows[0].id;
          } else {
            const insStatut = await clientDb.query('INSERT INTO Type_Statut_Abonnement (nom_statut) VALUES ($1) RETURNING id', [statutNom]);
            idTypeStatut = insStatut.rows[0].id;
          }

          const supportsList = CsvService.parseSupportsList(rawSupports);

          // 1. Validation de l'existence et détection des conflits de planning sur chaque support
          for (const supRef of supportsList) {
            const supUpper = supRef.toUpperCase();
            if (!supportsInBdd.has(supUpper)) {
              throw new Error(`Le support physique '${supRef}' n'existe pas en base de données. Veuillez l'importer dans l'inventaire au préalable.`);
            }

            // Détection de conflit via le module interne CsvService
            const conflict = await CsvService.checkSupportConflict(clientDb, {
              supportRef: supRef,
              excludeAboRef: refAbo,
              dateDebut: dateDebutRaw,
              dateFin: dateEcheanceRaw
            });

            if (conflict) {
              const debConflict = conflict.date_debut ? new Date(conflict.date_debut).toLocaleDateString('fr-FR') : '';
              const finConflict = conflict.date_echeance ? new Date(conflict.date_echeance).toLocaleDateString('fr-FR') : '';
              throw new Error(`Conflit de planning : le support '${supRef}' est déjà réservé par le contrat '${conflict.reference}' (${conflict.raison_sociale || 'Client'}) du ${debConflict} au ${finConflict}.`);
            }
          }

          // Détermination et normalisation de la périodicité
          let finalPeriodicite = (periodiciteRaw || '').trim();
          if (!finalPeriodicite) {
            const d1 = new Date(dateDebutRaw);
            const d2 = new Date(dateEcheanceRaw);
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
              const diffMonths = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
              if (diffMonths <= 1) finalPeriodicite = 'Mensuel';
              else if (diffMonths >= 2 && diffMonths <= 4) finalPeriodicite = 'Trimestriel';
              else if (diffMonths >= 5 && diffMonths <= 8) finalPeriodicite = 'Semestriel';
              else finalPeriodicite = 'Annuel';
            } else {
              finalPeriodicite = 'Annuel';
            }
          } else {
            const lower = finalPeriodicite.toLowerCase();
            if (lower === 'annuel' || lower === 'annuelle') finalPeriodicite = 'Annuel';
            else if (lower === 'semestriel' || lower === 'semestrielle') finalPeriodicite = 'Semestriel';
            else if (lower === 'trimestriel' || lower === 'trimestrielle') finalPeriodicite = 'Trimestriel';
            else if (lower === 'mensuel' || lower === 'mensuelle') finalPeriodicite = 'Mensuel';
            else {
              finalPeriodicite = finalPeriodicite.charAt(0).toUpperCase() + finalPeriodicite.slice(1);
            }
          }

          // 2. Création de l'abonnement
          await clientDb.query(`
            INSERT INTO Abonnement (
              reference, id_client, id_commercial, annonceur_campagne,
              tarif, periodicite, date_debut, date_echeance, reconduction_tacite
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
          `, [refAbo, clientId, commercialId, annonceur, tarifClean, finalPeriodicite, dateDebutRaw, dateEcheanceRaw]);
          rapport.abonnementsCrees++;

          // 3. Statut initial de l'abonnement
          await clientDb.query(`
            INSERT INTO Statut_Abonnement (id_abonnement, id_type_statut, date_debut, id_utilisateur, commentaire)
            VALUES ($1, $2, $3, $4, $5)
          `, [refAbo, idTypeStatut, dateDebutRaw, commercialId, 'Initialisé via import CSV']);

          // 4. Liaisons physiques Abonnement_Support
          for (const supRef of supportsList) {
            await clientDb.query(`
              INSERT INTO Abonnement_Support (id_abonnement, reference_support)
              VALUES ($1, $2)
              ON CONFLICT (id_abonnement, reference_support) DO NOTHING
            `, [refAbo, supRef]);
            rapport.supportsLies++;
          }

          // 5. Cascade directe vers l'état physique des supports (Etat_Support)
          await CsvService.cascadeStatutToSupports(clientDb, {
            refAbo,
            statutNom,
            dateDebut: dateDebutRaw,
            dateEcheance: dateEcheanceRaw,
            supportsList
          });

          abosInBdd.add(refUpper);
          await clientDb.query(`RELEASE SAVEPOINT row_${ligneNum}`);
        } catch (error) {
          await clientDb.query(`ROLLBACK TO SAVEPOINT row_${ligneNum}`);
          rapport.erreursCount++;
          rapport.erreurs.push({
            ligne: ligneNum,
            reference: refAbo || 'INCONNUE',
            motif: error.message
          });
        }
      }
      await clientDb.query('COMMIT');

      await JournalNotificationModel.logAction({
        categorie_action: 'IMPORT',
        entite_concernee: 'ABONNEMENT',
        reference_entite: 'CSV_ABONNEMENTS',
        valeur_apres: {
          totalLignes: rapport.totalLignes,
          abonnementsCrees: rapport.abonnementsCrees,
          supportsLies: rapport.supportsLies,
          doublonsInternes: rapport.doublonsInternes,
          doublonsBdd: rapport.doublonsBdd,
          erreursCount: rapport.erreursCount
        },
        message_notification: `Import de ${rapport.abonnementsCrees} ligne(s) de contrat(s) d'abonnement (sur ${rapport.totalLignes} ligne(s) traitée(s)).`
      });

      return rapport;
    } catch (error) {
      await clientDb.query('ROLLBACK');
      throw error;
    } finally {
      clientDb.release();
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) { }
      }
    }
  }
}
module.exports = CsvService;