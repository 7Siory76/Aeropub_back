const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../config/db');

/**
 * SERVICE : Traitement du fichier CSV Aeropub
*/

class CsvService {
  /**
   * Lit, analyse et insère le CSV d'emplacements et d'abonnements dans PostgreSQL
   * @param {string} filePath - Chemin vers le fichier CSV temporaire
   */

  static async processCsvFile(filePath) {
    const rawRows = [];

    return new Promise((resolve, reject) => {
      //lecture du csv avec gestion automatique des delimitateur (, ou ;)
      fs.createReadStream(filePath)
        .pipe(csv({ separator: ',' }))
        .on('data', (row) => {
          rawRows.push(row);
        })
        .on('end', async () => {
          const clientDb = await pool.connect();
          try {
            console.log(`CSV lu :${rawRows.length} lignes trouvees.`);
            await clientDb.query('BEGIN');
            let countEmplacements = 0;
            let countAbonnements = 0;

            for (const row of rawRows) {
              // Extraction des colonnes du csv
              const ref = (row.Reference || '').trim();
              const typeSupportNom = (row.Type_Support || row.type_support || '').trim();
              const zoneNom = (row.Zone || row.zone || '').trim();
              const lieuNom = (row.Localisation || row.localisation || '').trim();
              const formatNom = (row.format || row.Format || '').trim();
              const quantite = parseInt(row.Quantite || row.quantite || '1', 10);
              const statut = (row.statut || row.Statut || 'disponible').trim();
              const clientNom = (row.Nom_Client || row.nom_client || '').trim();
              const dateDebut = (row.Date_Debut || row.date_debut || '').trim();
              const dateFin = (row.Date_Fin || row.date_fin || '').trim();
              const dureeContrat = (row.Duree_Contrat || row.duree_contrat || '').trim();
              const refFacture = (row.Ref_Facture || row.ref_facture || '').trim();
              const observation = (row.Observation || row.observation || '').trim();

              if (!ref) continue;

              // obtenir ou creer la zone 
              let zoneId = null;
              if (zoneNom) {
                let resZone = await clientDb.query('Select id From Zone WHERE LOWER(type_zone) = LOWER($1)', [zoneNom]);
                zoneId = resZone.rows[0]?.id;
                if (!zoneId) {
                  const maxZ = await clientDb.query('SELECT COALESCE(MAX(id),0) + 1 AS next_id FROM Zone');
                  const insZ = await clientDb.query('INSERT INTO Zone (id,type_zone) VALUES ($1,$2) RETURNING id', [maxZ.rows[0].next_id, zoneNom]);
                  zoneId = insZ.rows[0].id;
                }
              }

              // obtenir ou creer la localisation
              let locId = null;
              if (lieuNom) {
                let resLoc = await clientDb.query('select id FROM Localisation WHERE LOWER(nom_lieu) = LOWER($1)', [lieuNom]);
                locId = resLoc.rows[0]?.id;
                if (!locId) {
                  const maxL = await clientDb.query('SELECT COALESCE(MAX(id),0) +1 AS nex_id FROM Localisation');
                  const insL = await clientDb.query('INSERT INTO Localisation (id,nom_lieu, id_zone) VALUES ($1, $2, $3) RETURNING id', [maxL.rows[0].next_id, lieuNom, zoneId || 1]);
                  locId = insL.rows[0].id;
                }
              }

              // obtenir ou creer le type de supoort 
              let tsId = null;
              if (typeSupportNom) {
                let resTs = await clientDb.query('SELECT id from TypeSupport WHERE LOWER(nom_type) = LOWER($1)', [typeSupportNom]);
                tsId = resTs.rows[0]?.id;
                if (!tsId) {
                  const maxTS = await clientDb.query('SELECT COALESCE(MAX(id), 0) +1 AS nex_id FROM TypeSupport');
                  const insTS = await clientDb.query('INSERT INTO TypeSupport (id, nom_type ($1, $2) RETURNING id',
                    [maxTS.rows[0].next_id, typeSupportNom]
                  );
                  tsId = insTS.rows[0].id;
                }
              }

              // obtenir ou creer le Format
              let formatId = null;
              if (formatNom) {
                let resFmt = await clientDb.query('SELECT id from Format WHERE LOWER(ref_format) = LOWER($1)', [formatNom]);
                formatId = resFmt.rows[0]?.id;
                if (!formatId) {
                  const maxF = await clientDb.query('SELECT COALESCE(MAX(id), 0) + 1 AS nex_id FROM Format');
                  const insFmt = await clientDb.query('INSERT INTO Format (id, ref_format) VALUES ($1,$2) RETURNING id', [maxF.rows[0].next_id, formatNom]);
                  formatId = insFmt.rows[0].id;
                }
              }

              // sauvegarder ou mettre a jour l emplacement (UPSERT)
              await clientDb.query(`INSERT INTO Emplacement (reference, id_format, id_type_support, id_localisation, id_categorie, quantite, statut, observation)
                VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
                ON CONFLICT (reference) DO UPDATE SET
                  id_format = COALESCE(EXCLUDED.id_format, Emplacement.id_format),
                  id_type_support = COALESCE(EXCLUDED.id_type_support, Emplacement.id_type_support),
                  id_localisation = COALESCE(EXCLUDED.id_localisation, Emplacement.id_localisation),
                  quantite = EXCLUDED.quantite,
                  statut = EXCLUDED.statut,
                  observation = EXCLUDED.observation
              `, [ref, formatId || 1, tsId || 1, locId || 1, quantite, statut, observation]);


              countEmplacements++;

              // Sauvegarder le Client et l'Abonnement (si présent)
              if (clientNom && dateDebut && dateFin) {
                let resCli = await clientDb.query('SELECT id FROM Client WHERE LOWER(nom_client) = LOWER($1)', [clientNom]);
                let clientId = resCli.rows[0]?.id;
                if (!clientId) {
                  const maxC = await clientDb.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Client');
                  const insCli = await clientDb.query('INSERT INTO Client (id, nom_client) VALUES ($1, $2) RETURNING id', [maxC.rows[0].next_id, clientNom]);
                  clientId = insCli.rows[0].id;
                }
                const maxAbo = await clientDb.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Abonnement');
                await clientDb.query(`
                  INSERT INTO Abonnement (id, date_debut, date_fin, duree_contrat, ref_facture, reference_emplacement, id_client)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                  maxAbo.rows[0].next_id,
                  dateDebut,
                  dateFin,
                  dureeContrat || null,
                  refFacture || null,
                  ref,
                  clientId
                ]);
                countAbonnements++;
              }
            }
            await clientDb.query('COMMIT');


            // Suppression du fichier temporaire
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            resolve({
              emplacementsImportes: countEmplacements,
              abonnementsCrees: countAbonnements
            });


          } catch (dbError) {
            await clientDb.query('ROLLBACK');
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            reject(dbError);


          } finally {
            clientDb.release();
          }
        })
        .on('error', (err) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(err);
        });
    });
  }


}

module.exports = CsvService;