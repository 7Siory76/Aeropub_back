const db = require('../config/db');

class ClientModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM Client ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM Client WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ id, nom_client, contact, secteur_activite }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Client');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO Client (id, nom_client, contact, secteur_activite) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [nextId, nom_client, contact || null, secteur_activite || null];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { nom_client, contact, secteur_activite }) {
    const query = 'UPDATE Client SET nom_client = $1, contact = $2, secteur_activite = $3 WHERE id = $4 RETURNING *';
    const { rows } = await db.query(query, [nom_client, contact || null, secteur_activite || null, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Client WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = ClientModel;
