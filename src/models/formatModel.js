const db = require('../config/db');

class FormatModel {
  static async getAll() {
    return [];
  }

  static async getById(id) {
    return null;
  }

  static async create({ id, ref_format }) {
    await this.ensureTable();
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Format');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO Format (id, ref_format) VALUES ($1, $2) RETURNING *';
    const values = [nextId, ref_format];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { ref_format }) {
    await this.ensureTable();
    const query = 'UPDATE Format SET ref_format = $1 WHERE id = $2 RETURNING *';
    const { rows } = await db.query(query, [ref_format, id]);
    return rows[0];
  }

  static async delete(id) {
    await this.ensureTable();
    const { rows } = await db.query('DELETE FROM Format WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = FormatModel;
