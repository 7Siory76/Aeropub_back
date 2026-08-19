const db = require('../config/db');

class LocalisationModel {
  static async getAll() {
    const query = `
      SELECT l.*, z.type_zone
      FROM Localisation l
      LEFT JOIN Zone z ON l.id_zone = z.id
      ORDER BY l.id ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(id) {
    const query = `
      SELECT l.*, z.type_zone
      FROM Localisation l
      LEFT JOIN Zone z ON l.id_zone = z.id
      WHERE l.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ id, nom_lieu, id_zone }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Localisation');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO Localisation (id, nom_lieu, id_zone) VALUES ($1, $2, $3) RETURNING *';
    const values = [nextId, nom_lieu, parseInt(id_zone, 10)];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { nom_lieu, id_zone }) {
    const query = 'UPDATE Localisation SET nom_lieu = $1, id_zone = $2 WHERE id = $3 RETURNING *';
    const { rows } = await db.query(query, [nom_lieu, id_zone, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Localisation WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = LocalisationModel;
