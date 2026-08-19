const db = require('../config/db');

class CategorieModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM Categorie ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM Categorie WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ id, nom_categorie }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Categorie');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const query = 'INSERT INTO Categorie (id, nom_categorie) VALUES ($1, $2) RETURNING *';
    const values = [nextId, nom_categorie];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { nom_categorie }) {
    const query = 'UPDATE Categorie SET nom_categorie = $1 WHERE id = $2 RETURNING *';
    const { rows } = await db.query(query, [nom_categorie, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Categorie WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = CategorieModel;
