const db = require('../config/db');

class EmplacementModel {
  static async getAll() {
    const query = `
      SELECT e.*, f.ref_format, ts.nom_type AS nom_type_support, l.nom_lieu, z.id AS id_zone, z.type_zone, c.nom_categorie
      FROM Emplacement e
      LEFT JOIN Format f ON e.id_format = f.id
      LEFT JOIN TypeSupport ts ON e.id_type_support = ts.id
      LEFT JOIN Localisation l ON e.id_localisation = l.id
      LEFT JOIN Zone z ON l.id_zone = z.id
      LEFT JOIN Categorie c ON e.id_categorie = c.id
      ORDER BY e.reference ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getByReference(reference) {
    const query = `
      SELECT e.*, f.ref_format, ts.nom_type AS nom_type_support, l.nom_lieu, z.id AS id_zone, z.type_zone, c.nom_categorie
      FROM Emplacement e
      LEFT JOIN Format f ON e.id_format = f.id
      LEFT JOIN TypeSupport ts ON e.id_type_support = ts.id
      LEFT JOIN Localisation l ON e.id_localisation = l.id
      LEFT JOIN Zone z ON l.id_zone = z.id
      LEFT JOIN Categorie c ON e.id_categorie = c.id
      WHERE e.reference = $1
    `;
    const { rows } = await db.query(query, [reference]);
    return rows[0];
  }

  static async create({ reference, id_format, id_type_support, id_localisation, id_categorie, quantite, statut, observation }) {
    const query = `
      INSERT INTO Emplacement (reference, id_format, id_type_support, id_localisation, id_categorie, quantite, statut, observation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      reference,
      parseInt(id_format, 10),
      parseInt(id_type_support, 10),
      parseInt(id_localisation, 10),
      id_categorie ? parseInt(id_categorie, 10) : null,
      quantite ? parseInt(quantite, 10) : 1,
      statut || 'disponible',
      observation || null
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(reference, { id_format, id_type_support, id_localisation, id_categorie, quantite, statut, observation }) {
    const query = `
      UPDATE Emplacement
      SET id_format = $1, id_type_support = $2, id_localisation = $3, id_categorie = $4, quantite = $5, statut = $6, observation = $7
      WHERE reference = $8
      RETURNING *
    `;
    const values = [
      parseInt(id_format, 10),
      parseInt(id_type_support, 10),
      parseInt(id_localisation, 10),
      id_categorie ? parseInt(id_categorie, 10) : null,
      quantite ? parseInt(quantite, 10) : 1,
      statut || 'disponible',
      observation || null,
      reference
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async delete(reference) {
    const { rows } = await db.query('DELETE FROM Emplacement WHERE reference = $1 RETURNING *', [reference]);
    return rows[0];
  }
}

module.exports = EmplacementModel;
