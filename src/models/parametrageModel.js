const db = require('../config/db');

class ParametrageModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM Parametrage ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM Parametrage WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ id, nom_parametre, valeur }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Parametrage');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO Parametrage (id, nom_parametre, valeur) VALUES ($1, $2, $3) RETURNING *';
    const values = [nextId, nom_parametre, valeur];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { valeur }) {
    const query = 'UPDATE Parametrage SET valeur = $1 WHERE id = $2 RETURNING *';
    const { rows } = await db.query(query, [valeur, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Parametrage WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = ParametrageModel;
