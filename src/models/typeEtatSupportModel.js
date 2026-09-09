const db = require('../config/db');

class TypeEtatSupportModel {
  static async getAll() {
    const { rows } = await db.query('SELECT id, nom_etat FROM Type_Etat_Support ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT id, nom_etat FROM Type_Etat_Support WHERE id = $1', [id]);
    return rows[0];
  }

  static async getByNom(nom) {
    if (!nom) return null;
    const { rows } = await db.query('SELECT id, nom_etat FROM Type_Etat_Support WHERE LOWER(nom_etat) = LOWER($1)', [String(nom).trim()]);
    return rows[0];
  }

  static async create({ nom_etat }) {
    const cleanNom = String(nom_etat || '').trim();
    const query = 'INSERT INTO Type_Etat_Support (nom_etat) VALUES ($1) RETURNING id, nom_etat';
    const { rows } = await db.query(query, [cleanNom]);
    return rows[0];
  }

  static async update(id, { nom_etat }) {
    const cleanNom = String(nom_etat || '').trim();
    const query = 'UPDATE Type_Etat_Support SET nom_etat = $1 WHERE id = $2 RETURNING id, nom_etat';
    const { rows } = await db.query(query, [cleanNom, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Type_Etat_Support WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = TypeEtatSupportModel;
