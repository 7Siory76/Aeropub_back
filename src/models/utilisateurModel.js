const db = require('../config/db');

class UtilisateurModel {
  static async getAll() {
    const query = `
      SELECT u.id, u.nom, u.email, u.id_role, u.actif, r.nom_role
      FROM Utilisateur u
      LEFT JOIN Role r ON u.id_role = r.id
      ORDER BY u.id ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(id) {
    const query = `
      SELECT u.id, u.nom, u.email, u.id_role, u.actif, r.nom_role
      FROM Utilisateur u
      LEFT JOIN Role r ON u.id_role = r.id
      WHERE u.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ nom, email, mot_de_passe_hash, id_role, actif }) {
    const query = `
      INSERT INTO Utilisateur (nom, email, mot_de_passe_hash, id_role, actif)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nom, email, id_role, actif
    `;
    const values = [nom, email, mot_de_passe_hash || 'default_hash', parseInt(id_role || 2, 10), actif !== undefined ? actif : true];
    const { rows } = await db.query(query, values);
    return this.getById(rows[0].id);
  }

  static async update(id, { nom, email, id_role, actif }) {
    const query = `
      UPDATE Utilisateur
      SET nom = COALESCE($1, nom),
          email = COALESCE($2, email),
          id_role = COALESCE($3, id_role),
          actif = COALESCE($4, actif)
      WHERE id = $5
      RETURNING id, nom, email, id_role, actif
    `;
    const values = [
      nom || null,
      email || null,
      id_role ? parseInt(id_role, 10) : null,
      actif !== undefined ? actif : null,
      id
    ];
    await db.query(query, values);
    return this.getById(id);
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Utilisateur WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }

  static async getAllRoles() {
    const { rows } = await db.query('SELECT * FROM Role ORDER BY id ASC');
    return rows;
  }
}

module.exports = UtilisateurModel;
