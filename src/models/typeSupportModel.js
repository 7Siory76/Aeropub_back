const db = require('../config/db');

class TypeSupportModel {
  static async getAll() {
    const { rows } = await db.query('SELECT id, nom, nom AS nom_type FROM Type_Support ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT id, nom, nom AS nom_type FROM Type_Support WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ nom, nom_type }) {
    const finalNom = nom || nom_type;
    const query = 'INSERT INTO Type_Support (nom) VALUES ($1) RETURNING id, nom, nom AS nom_type';
    const { rows } = await db.query(query, [finalNom]);
    return rows[0];
  }

  static async update(id, { nom, nom_type }) {
    const finalNom = nom || nom_type;
    const query = 'UPDATE Type_Support SET nom = $1 WHERE id = $2 RETURNING id, nom, nom AS nom_type';
    const { rows } = await db.query(query, [finalNom, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Type_Support WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = TypeSupportModel;
