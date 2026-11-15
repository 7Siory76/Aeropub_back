const db = require('../config/db');
const JournalNotificationModel = require('./journalNotificationModel');

class ZoneModel {
  static async getAll() {
    const query = `
      SELECT 
        zt.id,
        zt.nom_zone,
        zt.nom_zone AS type_zone,
        zt.nom_zone AS nom_lieu,
        zt.id_aeroport,
        zt.id_perimetre,
        aero.nom AS nom_aeroport,
        peri.nom AS nom_perimetre,
        CONCAT(aero.nom, ' (', peri.nom, ')') AS designation_complete
      FROM Zone_Terminal zt
      LEFT JOIN Aeroport aero ON zt.id_aeroport = aero.id
      LEFT JOIN Perimetre peri ON zt.id_perimetre = peri.id
      ORDER BY zt.id ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(id) {
    const query = `
      SELECT 
        zt.id,
        zt.nom_zone,
        zt.nom_zone AS type_zone,
        zt.nom_zone AS nom_lieu,
        zt.id_aeroport,
        zt.id_perimetre,
        aero.nom AS nom_aeroport,
        peri.nom AS nom_perimetre
      FROM Zone_Terminal zt
      LEFT JOIN Aeroport aero ON zt.id_aeroport = aero.id
      LEFT JOIN Perimetre peri ON zt.id_perimetre = peri.id
      WHERE zt.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ nom_zone, type_zone, id_aeroport, id_perimetre }) {
    const finalNom = nom_zone || type_zone;
    const query = `
      INSERT INTO Zone_Terminal (nom_zone, id_aeroport, id_perimetre)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [finalNom, parseInt(id_aeroport || 1, 10), parseInt(id_perimetre || 1, 10)];
    const { rows } = await db.query(query, values);
    const created = await this.getById(rows[0].id);

    await JournalNotificationModel.logAction({
      categorie_action: 'CREATION',
      entite_concernee: 'ZONE',
      reference_entite: String(created.id),
      valeur_apres: created,
      message_notification: `Nouvelle zone "${created.nom_zone}" (ID: ${created.id}) créée.`
    });

    return created;
  }

  static async update(id, { nom_zone, type_zone, id_aeroport, id_perimetre }) {
    const finalNom = nom_zone || type_zone;
    const query = `
      UPDATE Zone_Terminal
      SET nom_zone = COALESCE($1, nom_zone),
          id_aeroport = COALESCE($2, id_aeroport),
          id_perimetre = COALESCE($3, id_perimetre)
      WHERE id = $4
      RETURNING *
    `;
    const values = [
      finalNom || null,
      id_aeroport ? parseInt(id_aeroport, 10) : null,
      id_perimetre ? parseInt(id_perimetre, 10) : null,
      id
    ];
    const { rows } = await db.query(query, values);
    const updated = await this.getById(id);

    await JournalNotificationModel.logAction({
      categorie_action: 'MODIFICATION',
      entite_concernee: 'ZONE',
      reference_entite: String(id),
      valeur_apres: updated,
      message_notification: `Mise à jour de la zone "${updated.nom_zone}" (ID: ${id}).`
    });

    return updated;
  }

  static async delete(id) {
    const current = await this.getById(id);
    const { rows } = await db.query('DELETE FROM Zone_Terminal WHERE id = $1 RETURNING *', [id]);

    await JournalNotificationModel.logAction({
      categorie_action: 'SUPPRESSION',
      entite_concernee: 'ZONE',
      reference_entite: String(id),
      valeur_apres: current,
      message_notification: `Suppression de la zone "${current?.nom_zone || id}".`
    });

    return rows[0];
  }

  // --- Référentiels Aéroports & Périmètres ---
  static async getAllAeroports() {
    const { rows } = await db.query('SELECT id, nom FROM Aeroport ORDER BY nom ASC');
    return rows;
  }

  static async getAllPerimetres() {
    const { rows } = await db.query('SELECT id, nom FROM Perimetre ORDER BY nom ASC');
    return rows;
  }
}

module.exports = ZoneModel;
