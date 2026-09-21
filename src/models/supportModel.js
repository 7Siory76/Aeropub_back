const db = require('../config/db');
const JournalNotificationModel = require('./journalNotificationModel');

class SupportModel {
  static async resolveIdTypeEtat(etatOrId) {
    if (!etatOrId) {
      const res = await db.query("SELECT id FROM Type_Etat_Support WHERE LOWER(nom_etat) = 'disponible' LIMIT 1");
      return res.rows[0]?.id || 1;
    }
    if (typeof etatOrId === 'number' || (!isNaN(Number(etatOrId)) && String(etatOrId).trim() !== '')) {
      return parseInt(etatOrId, 10);
    }
    const cleanNom = String(etatOrId).trim();
    const res = await db.query('SELECT id FROM Type_Etat_Support WHERE LOWER(nom_etat) = LOWER($1) LIMIT 1', [cleanNom]);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    try {
      const created = await db.query('INSERT INTO Type_Etat_Support (nom_etat) VALUES ($1) RETURNING id', [cleanNom]);
      return created.rows[0].id;
    } catch {
      const fallback = await db.query('SELECT id FROM Type_Etat_Support LIMIT 1');
      return fallback.rows[0]?.id || 1;
    }
  }

  static async getAll() {
    const query = `
      SELECT 
        s.reference,
        s.id_zone,
        s.id_categorie,
        s.id_type,
        s.id_type AS id_type_support,
        s.caracteristiques,
        s.caracteristiques AS ref_format,
        ts.nom AS nom_type_support,
        ts.nom AS nom_type,
        cs.nom AS nom_categorie,
        zt.nom_zone,
        zt.nom_zone AS nom_lieu,
        zt.id AS id_localisation,
        zt.id_aeroport,
        zt.id_perimetre,
        aero.nom AS nom_aeroport,
        peri.nom AS nom_perimetre,
        CONCAT(aero.nom, ' - ', peri.nom) AS type_zone,
        COALESCE(es.etat, 'disponible') AS statut,
        COALESCE(es.etat, 'disponible') AS etat,
        es.id_type_etat,
        es.observation,
        es.date_debut AS date_etat,
        es.date_debut AS date_debut_etat,
        es.date_fin AS date_fin_etat,
        1 AS quantite
      FROM Support s
      LEFT JOIN Zone_Terminal zt ON s.id_zone = zt.id
      LEFT JOIN Aeroport aero ON zt.id_aeroport = aero.id
      LEFT JOIN Perimetre peri ON zt.id_perimetre = peri.id
      LEFT JOIN Categorie_Support cs ON s.id_categorie = cs.id
      LEFT JOIN Type_Support ts ON s.id_type = ts.id
      LEFT JOIN LATERAL (
        SELECT 
          es.id_type_etat, 
          tes.nom_etat AS etat, 
          es.observation, 
          es.date_debut, 
          es.date_fin
        FROM Etat_Support es
        LEFT JOIN Type_Etat_Support tes ON es.id_type_etat = tes.id
        WHERE es.reference_support = s.reference
          AND es.date_debut <= CURRENT_TIMESTAMP
          AND (es.date_fin IS NULL OR es.date_fin >= CURRENT_TIMESTAMP)
        ORDER BY es.id DESC
        LIMIT 1
      ) es ON true

      ORDER BY s.reference ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getByReference(reference) {
    const query = `
      SELECT 
        s.reference,
        s.id_zone,
        s.id_categorie,
        s.id_type,
        s.id_type AS id_type_support,
        s.caracteristiques,
        s.caracteristiques AS ref_format,
        ts.nom AS nom_type_support,
        ts.nom AS nom_type,
        cs.nom AS nom_categorie,
        zt.nom_zone,
        zt.nom_zone AS nom_lieu,
        zt.id AS id_localisation,
        zt.id_aeroport,
        zt.id_perimetre,
        aero.nom AS nom_aeroport,
        peri.nom AS nom_perimetre,
        CONCAT(aero.nom, ' - ', peri.nom) AS type_zone,
        COALESCE(es.etat, 'disponible') AS statut,
        COALESCE(es.etat, 'disponible') AS etat,
        es.id_type_etat,
        es.observation,
        es.date_debut AS date_etat,
        es.date_debut AS date_debut_etat,
        es.date_fin AS date_fin_etat,
        1 AS quantite
      FROM Support s
      LEFT JOIN Zone_Terminal zt ON s.id_zone = zt.id
      LEFT JOIN Aeroport aero ON zt.id_aeroport = aero.id
      LEFT JOIN Perimetre peri ON zt.id_perimetre = peri.id
      LEFT JOIN Categorie_Support cs ON s.id_categorie = cs.id
      LEFT JOIN Type_Support ts ON s.id_type = ts.id
      LEFT JOIN LATERAL (
        SELECT 
          es.id_type_etat, 
          tes.nom_etat AS etat, 
          es.observation, 
          es.date_debut, 
          es.date_fin
        FROM Etat_Support es
        LEFT JOIN Type_Etat_Support tes ON es.id_type_etat = tes.id
        WHERE es.reference_support = s.reference
          AND es.date_debut <= CURRENT_TIMESTAMP
          AND (es.date_fin IS NULL OR es.date_fin >= CURRENT_TIMESTAMP)
        ORDER BY es.id DESC
        LIMIT 1
      ) es ON true
      WHERE s.reference = $1
    `;
    const { rows } = await db.query(query, [reference]);
    return rows[0];
  }

  static async create({ 
    reference, 
    id_zone, 
    id_categorie, 
    id_type, 
    id_type_support, 
    id_type_etat, 
    caracteristiques, 
    statut, 
    etat, 
    observation, 
    id_utilisateur,
    date_debut,
    date_fin
  }) {
    if (date_debut && date_fin && new Date(date_fin) < new Date(date_debut)) {
      const error = new Error("La date de fin doit être postérieure ou égale à la date de début.");
      error.statusCode = 400;
      throw error;
    }

    const finalType = id_type || id_type_support || 1;
    const finalZone = id_zone || 1;
    const finalCat = id_categorie || 1;

    // 1. Insérer le support
    const insertSupportQuery = `
      INSERT INTO Support (reference, id_zone, id_categorie, id_type, caracteristiques)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    await db.query(insertSupportQuery, [
      reference,
      parseInt(finalZone, 10),
      parseInt(finalCat, 10),
      parseInt(finalType, 10),
      caracteristiques || null
    ]);

    // 2. Résoudre et insérer l'état initial
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateSaisieStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const obsText = observation ? `[Saisie le ${dateSaisieStr}] ${observation}` : `[Saisie le ${dateSaisieStr}] Création du support`;

    const resolvedIdEtat = await this.resolveIdTypeEtat(id_type_etat || etat || statut || 'disponible');
    const finalDateDebut = date_debut ? new Date(date_debut) : now;
    const finalDateFin = date_fin ? new Date(date_fin) : null;

    await db.query(`
      INSERT INTO Etat_Support (reference_support, id_type_etat, date_debut, date_fin, id_utilisateur, observation)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [reference, resolvedIdEtat, finalDateDebut, finalDateFin, id_utilisateur || null, obsText]);

    // Journalisation
    await JournalNotificationModel.logAction({
      id_utilisateur: id_utilisateur ? parseInt(id_utilisateur, 10) : null,
      categorie_action: 'CREATION',
      entite_concernee: 'SUPPORT',
      reference_entite: reference,
      valeur_apres: { reference, finalType, finalZone, finalCat },
      message_notification: `Création du support ${reference}.`
    });

    return this.getByReference(reference);
  }

  static async update(reference, { 
    id_zone, 
    id_categorie, 
    id_type, 
    id_type_support, 
    id_type_etat, 
    caracteristiques, 
    statut, 
    etat, 
    observation, 
    id_utilisateur,
    date_debut,
    date_fin
  }) {
    if (date_debut && date_fin && new Date(date_fin) < new Date(date_debut)) {
      const error = new Error("La date de fin de l'état doit être postérieure ou égale à la date de début.");
      error.statusCode = 400;
      throw error;
    }

    const current = await this.getByReference(reference);
    if (!current) {
      const error = new Error(`Support avec la référence "${reference}" introuvable.`);
      error.statusCode = 404;
      throw error;
    }

    // 1. Mettre à jour les champs techniques du support si fournis
    if (id_zone || id_categorie || id_type || id_type_support || caracteristiques !== undefined) {
      await db.query(`
        UPDATE Support
        SET id_zone = COALESCE($1, id_zone),
            id_categorie = COALESCE($2, id_categorie),
            id_type = COALESCE($3, id_type),
            caracteristiques = COALESCE($4, caracteristiques)
        WHERE reference = $5
      `, [
        id_zone ? parseInt(id_zone, 10) : null,
        id_categorie ? parseInt(id_categorie, 10) : null,
        (id_type || id_type_support) ? parseInt(id_type || id_type_support, 10) : null,
        caracteristiques !== undefined ? caracteristiques : null,
        reference
      ]);
    }

    // 2. Mettre à jour l'historique d'état si un nouvel état, de nouvelles dates ou une observation nouvelle est fournie
    const newState = id_type_etat || etat || statut;
    const resolvedIdEtat = await this.resolveIdTypeEtat(newState || current.id_type_etat || 'disponible');

    const cleanObs = (observation || '').replace(/^\[Saisie le [^\]]+\]\s*/, '').trim();
    const currentCleanObs = (current.observation || '').replace(/^\[Saisie le [^\]]+\]\s*/, '').trim();
    const isEtatChanged = Boolean(newState && current.id_type_etat !== resolvedIdEtat);
    const isObsChanged = observation !== undefined && cleanObs !== currentCleanObs && cleanObs !== '';
    const isDatesChanged = Boolean((date_debut && date_debut !== current.date_debut_etat) || (date_fin && date_fin !== current.date_fin_etat));

    if (isEtatChanged || isObsChanged || isDatesChanged) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateSaisieStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const obsText = cleanObs ? `[Saisie le ${dateSaisieStr}] ${cleanObs}` : `[Saisie le ${dateSaisieStr}] Mise à jour de l'état`;

      // Déterminer les dates début et fin cibles:
      // Si le support est lié à un abonnement futur ou en cours, conserver la date contractuelle
      const aboRes = await db.query(`
        SELECT a.reference, a.date_debut, a.date_echeance 
        FROM Abonnement_Support asup 
        JOIN Abonnement a ON asup.id_abonnement = a.reference 
        WHERE asup.reference_support = $1 
          AND (a.date_echeance IS NULL OR a.date_echeance >= CURRENT_TIMESTAMP)
        ORDER BY a.date_debut DESC LIMIT 1
      `, [reference]);
      const activeAbo = aboRes.rows[0];

      let targetDateDebut;
      let targetDateFin;

      if (date_debut) {
        targetDateDebut = new Date(date_debut);
      } else if (activeAbo && newState && !String(newState).toLowerCase().includes('dispo')) {
        // Garder la date de début contractuelle de l'abonnement même si le contrat est dans le futur
        targetDateDebut = activeAbo.date_debut;
      } else if (current.date_debut_etat && new Date(current.date_debut_etat) > now && (!newState || !String(newState).toLowerCase().includes('dispo'))) {
        targetDateDebut = current.date_debut_etat;
      } else {
        targetDateDebut = now;
      }

      if (date_fin !== undefined) {
        targetDateFin = date_fin ? new Date(date_fin) : null;
      } else if (activeAbo && (!newState || !String(newState).toLowerCase().includes('dispo'))) {
        targetDateFin = activeAbo.date_echeance;
      } else if (current.date_fin_etat && (!newState || !String(newState).toLowerCase().includes('dispo'))) {
        targetDateFin = current.date_fin_etat;
      } else {
        targetDateFin = null;
      }

      // Clôturer l'état précédent actif ou programmé
      await db.query(`
        UPDATE Etat_Support
        SET date_fin = CURRENT_TIMESTAMP
        WHERE reference_support = $1 AND (date_fin IS NULL OR date_fin > CURRENT_TIMESTAMP)
      `, [reference]);

      // Insérer le nouvel état
      await db.query(`
        INSERT INTO Etat_Support (reference_support, id_type_etat, date_debut, date_fin, id_utilisateur, observation)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        reference,
        resolvedIdEtat,
        targetDateDebut,
        targetDateFin,
        id_utilisateur || null,
        obsText
      ]);
    }

    // Journalisation de la mise à jour
    await JournalNotificationModel.logAction({
      id_utilisateur: id_utilisateur ? parseInt(id_utilisateur, 10) : null,
      categorie_action: isEtatChanged ? 'ETAT' : 'MODIFICATION',
      entite_concernee: 'SUPPORT',
      reference_entite: reference,
      valeur_apres: {
        reference,
        etat: newState || current.etat
      },
      message_notification: isEtatChanged
        ? `Support ${reference} : passage à l'état "${newState}".`
        : `Mise à jour des informations du support ${reference}.`
    });

    return this.getByReference(reference);
  }

  static async delete(reference) {
    const current = await this.getByReference(reference);
    await db.query('DELETE FROM Etat_Support WHERE reference_support = $1', [reference]);
    await db.query('DELETE FROM Abonnement_Support WHERE reference_support = $1', [reference]);
    const { rows } = await db.query('DELETE FROM Support WHERE reference = $1 RETURNING *', [reference]);

    await JournalNotificationModel.logAction({
      categorie_action: 'SUPPRESSION',
      entite_concernee: 'SUPPORT',
      reference_entite: reference,
      valeur_apres: current,
      message_notification: `Suppression du support ${reference}.`
    });

    return rows[0];
  }

  static async getHistoriqueEtats(reference) {
    const query = `
      SELECT es.*, tes.nom_etat AS etat, u.nom AS nom_utilisateur
      FROM Etat_Support es
      LEFT JOIN Type_Etat_Support tes ON es.id_type_etat = tes.id
      LEFT JOIN Utilisateur u ON es.id_utilisateur = u.id
      WHERE es.reference_support = $1
      ORDER BY es.id DESC
    `;
    const { rows } = await db.query(query, [reference]);
    return rows;
  }
}

module.exports = SupportModel;
