const db = require('../config/db');
const bcrypt = require('bcryptjs');

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

  static async create({ nom, email, mot_de_passe, mot_de_passe_hash, id_role, actif }) {
    let finalHash = mot_de_passe_hash || mot_de_passe || 'secret123';
    if (finalHash && !finalHash.startsWith('$2')) {
      finalHash = await bcrypt.hash(finalHash, 10);
    }

    const query = `
      INSERT INTO Utilisateur (nom, email, mot_de_passe_hash, id_role, actif)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nom, email, id_role, actif
    `;
    const values = [
      nom,
      email,
      finalHash,
      parseInt(id_role || 2, 10),
      actif !== undefined ? (actif === true || String(actif) === 'true' || String(actif) === '1') : true
    ];
    const { rows } = await db.query(query, values);
    return this.getById(rows[0].id);
  }

  static async update(id, { nom, email, id_role, actif, mot_de_passe, mot_de_passe_hash }) {
    let passwordHash = null;
    const rawPass = mot_de_passe || mot_de_passe_hash;
    if (rawPass && typeof rawPass === 'string' && rawPass.trim().length > 0) {
      if (rawPass.startsWith('$2')) {
        passwordHash = rawPass;
      } else {
        passwordHash = await bcrypt.hash(rawPass.trim(), 10);
      }
    }

    const query = `
      UPDATE Utilisateur
      SET nom = COALESCE($1, nom),
          email = COALESCE($2, email),
          id_role = COALESCE($3, id_role),
          actif = COALESCE($4, actif),
          mot_de_passe_hash = COALESCE($5, mot_de_passe_hash)
      WHERE id = $6
      RETURNING id, nom, email, id_role, actif
    `;
    const values = [
      nom || null,
      email || null,
      id_role ? parseInt(id_role, 10) : null,
      actif !== undefined ? (actif === true || String(actif) === 'true' || String(actif) === '1') : null,
      passwordHash,
      id
    ];
    await db.query(query, values);
    return this.getById(id);
  }

  static async delete(id) {
    // Vérifier si l'utilisateur est commercial sur des abonnements
    const aboCheck = await db.query('SELECT reference FROM Abonnement WHERE id_commercial = $1 LIMIT 1', [id]);
    if (aboCheck.rows.length > 0) {
      const error = new Error("Impossible de supprimer cet utilisateur car il est associé à un ou plusieurs contrats d'abonnement en tant que commercial. Vous pouvez plutôt le désactiver (statut Inactif).");
      error.statusCode = 400;
      throw error;
    }

    const { rows } = await db.query('DELETE FROM Utilisateur WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }

  static async getAllRoles() {
    const { rows } = await db.query('SELECT * FROM Role ORDER BY id ASC');
    return rows;
  }
  static async findByEmail(email) {
    const query = `
      SELECT 
       u.id,
       u.nom,
       u.email,
       u.mot_de_passe_hash,
       u.id_role,
       u.actif,
       r.nom_role AS role
      FROM Utilisateur u JOIN Role r on u.id_role = r.id
      WHERE LOWER(u.email) = LOWER($1)
    `;
    const { rows } = await db.query(query, [email.trim()]);
    return rows[0];
  }
}

module.exports = UtilisateurModel;
