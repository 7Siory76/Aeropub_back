const db = require('../config/db');

class ZoneModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM Zone ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM Zone WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ id, type_zone }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Zone');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO Zone (id, type_zone) VALUES ($1, $2) RETURNING *';
    const values = [nextId, type_zone];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { type_zone }) {
    const query = 'UPDATE Zone SET type_zone = $1 WHERE id = $2 RETURNING *';
    const { rows } = await db.query(query, [type_zone, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Zone WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = ZoneModel;
