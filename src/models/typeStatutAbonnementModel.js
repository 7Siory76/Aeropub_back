const db = require('../config/db');

class TypeStatutAbonnementModel {
  static async getAll() {
    const { rows } = await db.query('SELECT id, nom_statut FROM Type_Statut_Abonnement ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT id, nom_statut FROM Type_Statut_Abonnement WHERE id = $1', [id]);
    return rows[0];
  }

  static async getByNom(nom) {
    if (!nom) return null;
    const { rows } = await db.query('SELECT id, nom_statut FROM Type_Statut_Abonnement WHERE LOWER(nom_statut) = LOWER($1)', [String(nom).trim()]);
    return rows[0];
  }

  static async create({ nom_statut }) {
    const cleanNom = String(nom_statut || '').trim();
    const query = 'INSERT INTO Type_Statut_Abonnement (nom_statut) VALUES ($1) RETURNING id, nom_statut';
    const { rows } = await db.query(query, [cleanNom]);
    return rows[0];
  }

  static async update(id, { nom_statut }) {
    const cleanNom = String(nom_statut || '').trim();
    const query = 'UPDATE Type_Statut_Abonnement SET nom_statut = $1 WHERE id = $2 RETURNING id, nom_statut';
    const { rows } = await db.query(query, [cleanNom, id]);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Type_Statut_Abonnement WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = TypeStatutAbonnementModel;
