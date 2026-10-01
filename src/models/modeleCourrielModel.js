const db = require('../config/db');

class ModeleCourrielModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM Modele_Courriel ORDER BY id ASC');
    return rows;
  }

  static async getByCode(code) {
    const { rows } = await db.query('SELECT * FROM Modele_Courriel WHERE code = $1', [code]);
    return rows[0] || null;
  }

  static async updateByCode(code, { sujet, corps, nom }) {
    const { rows } = await db.query(
      `UPDATE Modele_Courriel
       SET sujet = COALESCE($1, sujet),
           corps = COALESCE($2, corps),
           nom = COALESCE($3, nom),
           date_modification = CURRENT_TIMESTAMP
       WHERE code = $4
       RETURNING *`,
      [sujet, corps, nom || null, code]
    );
    return rows[0] || null;
  }
}

module.exports = ModeleCourrielModel;
