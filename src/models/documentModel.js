const db = require('../config/db');

class DocumentModel {
  static async getAll() {
    const query = `
      SELECT 
        d.*,
        c.raison_sociale AS nom_client,
        a.annonceur_campagne
      FROM Document_Lie d
      LEFT JOIN Client c ON d.id_client = c.id
      LEFT JOIN Abonnement a ON d.id_abonnement = a.reference
      ORDER BY d.date_upload DESC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(id) {
    const query = 'SELECT * FROM Document_Lie WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ id_abonnement, id_client, reference_support, nom_fichier, url_chemin, type_document }) {
    const query = `
      INSERT INTO Document_Lie (id_abonnement, id_client, reference_support, nom_fichier, url_chemin, type_document)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      id_abonnement || null,
      id_client ? parseInt(id_client, 10) : null,
      reference_support || null,
      nom_fichier,
      url_chemin,
      type_document || 'Contrat'
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Document_Lie WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = DocumentModel;
