const db = require('../config/db');

class TypeSupportModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM TypeSupport ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM TypeSupport WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ id, nom_type }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM TypeSupport');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO TypeSupport (id, nom_type) VALUES ($1, $2) RETURNING *';
    const values = [nextId, nom_type];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { nom_type }) {
    const query = 'UPDATE TypeSupport SET nom_type = $1 WHERE id = $2 RETURNING *';
    const { rows } = await db.query(query, [nom_type, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM TypeSupport WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = TypeSupportModel;
