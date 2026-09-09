const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../config/db');

/**
 * SERVICE : Traitement du fichier CSV AeroPub pour le schéma base_v3.sql
 */
class CsvService {
  /**
   * Lit, analyse et insère le CSV dans PostgreSQL en respectant les relations de base_v3.sql
   * @param {string} filePath - Chemin vers le fichier CSV temporaire
   */
  static async processCsvFile(filePath) {
    const rawRows = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator: ',' }))
        .on('data', (row) => {
          rawRows.push(row);
        })
        .on('end', async () => {
          const clientDb = await pool.connect();
          try {
            console.log(`CSV lu : ${rawRows.length} lignes trouvées.`);
            await clientDb.query('BEGIN');
            let countSupports = 0;
            let countAbonnements = 0;

            for (const row of rawRows) {
              const ref = (row.Reference || row.reference || row.Ref || '').trim();
              if (!ref) continue;

              const typeSupportNom = (row.Type_Support || row.type_support || row.Type || 'Standard').trim();
              const catNom = (row.Categorie || row.categorie || row.Categorie_Support || 'Statique').trim();
              const aeroNom = (row.Aeroport || row.aeroport || 'Ivato').trim();
              const periNom = (row.Perimetre || row.perimetre || 'National').trim();
              const zoneNom = (row.Zone || row.zone || row.Zone_Terminal || row.Localisation || row.localisation || 'Zone Générale').trim();
              const caracteristiques = (row.Caracteristiques || row.caracteristiques || row.format || row.Format || row.Observation || '').trim();
              const statut = (row.statut || row.Statut || row.etat || row.Etat || 'Disponible').trim();
              const observation = (row.Observation || row.observation || '').trim();

              const clientNom = (row.Nom_Client || row.nom_client || row.Client || row.Raison_Sociale || '').trim();
              const contactVal = (row.Contact || row.contact || '').trim();
              const dateDebut = (row.Date_Debut || row.date_debut || '').trim();
              const dateFin = (row.Date_Fin || row.date_fin || row.Date_Echeance || row.date_echeance || '').trim();
              const campagne = (row.Campagne || row.campagne || row.Annonceur || row.annonceur || row.Ref_Facture || row.ref_facture || '').trim();
              const tarifVal = parseFloat(row.Tarif || row.tarif || row.Prix || row.prix || '0') || 0;

              // 1. Aéroport
              let aeroId = 1;
              const resAero = await clientDb.query('SELECT id FROM Aeroport WHERE LOWER(nom) = LOWER($1)', [aeroNom]);
              if (resAero.rows.length > 0) {
                aeroId = resAero.rows[0].id;
              } else {
                const insA = await clientDb.query('INSERT INTO Aeroport (nom) VALUES ($1) ON CONFLICT (nom) DO UPDATE SET nom=EXCLUDED.nom RETURNING id', [aeroNom]);
                aeroId = insA.rows[0].id;
              }

              // 2. Périmètre
              let periId = 1;
              const resPeri = await clientDb.query('SELECT id FROM Perimetre WHERE LOWER(nom) = LOWER($1)', [periNom]);
              if (resPeri.rows.length > 0) {
                periId = resPeri.rows[0].id;
              } else {
                const insP = await clientDb.query('INSERT INTO Perimetre (nom) VALUES ($1) ON CONFLICT (nom) DO UPDATE SET nom=EXCLUDED.nom RETURNING id', [periNom]);
                periId = insP.rows[0].id;
              }

              // 3. Zone_Terminal
              let zoneId = 1;
              const resZone = await clientDb.query('SELECT id FROM Zone_Terminal WHERE LOWER(nom_zone) = LOWER($1)', [zoneNom]);
              if (resZone.rows.length > 0) {
                zoneId = resZone.rows[0].id;
              } else {
                const insZ = await clientDb.query('INSERT INTO Zone_Terminal (nom_zone, id_aeroport, id_perimetre) VALUES ($1, $2, $3) RETURNING id', [zoneNom, aeroId, periId]);
                zoneId = insZ.rows[0].id;
              }

              // 4. Catégorie Support
              let catId = 1;
              const resCat = await clientDb.query('SELECT id FROM Categorie_Support WHERE LOWER(nom) = LOWER($1)', [catNom]);
              if (resCat.rows.length > 0) {
                catId = resCat.rows[0].id;
              } else {
                const insC = await clientDb.query('INSERT INTO Categorie_Support (nom) VALUES ($1) ON CONFLICT (nom) DO UPDATE SET nom=EXCLUDED.nom RETURNING id', [catNom]);
                catId = insC.rows[0].id;
              }

              // 5. Type Support
              let tsId = 1;
              const resTs = await clientDb.query('SELECT id FROM Type_Support WHERE LOWER(nom) = LOWER($1)', [typeSupportNom]);
              if (resTs.rows.length > 0) {
                tsId = resTs.rows[0].id;
              } else {
                const insTs = await clientDb.query('INSERT INTO Type_Support (nom) VALUES ($1) ON CONFLICT (nom) DO UPDATE SET nom=EXCLUDED.nom RETURNING id', [typeSupportNom]);
                tsId = insTs.rows[0].id;
              }

              // 6. Support (UPSERT)
              await clientDb.query(`
                INSERT INTO Support (reference, id_zone, id_categorie, id_type, caracteristiques)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (reference) DO UPDATE SET
                  id_zone = EXCLUDED.id_zone,
                  id_categorie = EXCLUDED.id_categorie,
                  id_type = EXCLUDED.id_type,
                  caracteristiques = COALESCE(EXCLUDED.caracteristiques, Support.caracteristiques)
              `, [ref, zoneId, catId, tsId, caracteristiques || null]);

              // 7. État du Support (Historique Zéro Perte)
              await clientDb.query(`
                INSERT INTO Etat_Support (reference_support, etat, date_debut, observation)
                VALUES ($1, $2, NOW(), $3)
              `, [ref, statut, observation || null]);

              countSupports++;

              // 8. Client & Abonnement (si présent dans la ligne)
              if (clientNom && dateDebut) {
                let clientId = 1;
                const resCli = await clientDb.query('SELECT id FROM Client WHERE LOWER(raison_sociale) = LOWER($1)', [clientNom]);
                if (resCli.rows.length > 0) {
                  clientId = resCli.rows[0].id;
                } else {
                  const insCli = await clientDb.query('INSERT INTO Client (raison_sociale) VALUES ($1) RETURNING id', [clientNom]);
                  clientId = insCli.rows[0].id;
                }

                if (contactVal) {
                  await clientDb.query(`
                    INSERT INTO Contact (id_client, nom_contact, valeur, est_principal)
                    VALUES ($1, 'Contact Principal', $2, TRUE)
                  `, [clientId, contactVal]);
                }

                const aboRef = `ABO-${ref}-${Date.now().toString().slice(-4)}`;
                const dFin = dateFin || new Date(new Date(dateDebut).getTime() + 365 * 24 * 3600 * 1000).toISOString();

                await clientDb.query(`
                  INSERT INTO Abonnement (
                    reference, id_client, id_commercial, annonceur_campagne, tarif,
                    devise, periodicite, date_debut, date_echeance, reconduction_tacite
                  )
                  VALUES ($1, $2, 1, $3, $4, 'MGA', 'Annuel', $5, $6, FALSE)
                  ON CONFLICT (reference) DO NOTHING
                `, [aboRef, clientId, campagne || clientNom, tarifVal, dateDebut, dFin]);

                await clientDb.query(`
                  INSERT INTO Abonnement_Support (id_abonnement, reference_support)
                  VALUES ($1, $2)
                  ON CONFLICT DO NOTHING
                `, [aboRef, ref]);

                await clientDb.query(`
                  INSERT INTO Statut_Abonnement (id_abonnement, statut, date_debut, commentaire)
                  VALUES ($1, 'Actif', NOW(), 'Importé via fichier CSV')
                `, [aboRef]);

                countAbonnements++;
              }
            }

            await clientDb.query('COMMIT');

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            resolve({
              emplacementsImportes: countSupports,
              abonnementsCrees: countAbonnements
            });
          } catch (dbError) {
            await clientDb.query('ROLLBACK');
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            reject(dbError);
          } finally {
            clientDb.release();
          }
        })
        .on('error', (err) => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          reject(err);
        });
    });
  }
}

module.exports = CsvService;