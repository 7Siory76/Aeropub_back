const db = require('../config/db');

class DocumentModel {
  static async getAll() {
    const query = `
      SELECT 
        d.*,
        c.raison_sociale AS nom_client,
        a.annonceur_campagne
      FROM Document_Lie d
      LEFT JOIN Abonnement a ON d.id_abonnement = a.reference
      LEFT JOIN Client c ON a.id_client = c.id
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

  // Insertion sans id_client (reliant directement à l'abonnement)
  static async create({ id_abonnement, reference_support, nom_fichier, url_chemin, type_document }) {
    const query = `
      INSERT INTO Document_Lie (id_abonnement, reference_support, nom_fichier, url_chemin, type_document)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      id_abonnement,
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

  /**
   * Récupère tous les documents de l'abonnement ET ceux de ses contrats précédents liés !
   */
  static async getByAbonnement(reference) {
    const query = `
    WITH RECURSIVE chaine_abos AS (
    SELECT
      reference,
      id_abonnement_precedent,
      0 AS niveau
    FROM Abonnement
    WHERE reference = $1

    UNION ALL

    SELECT
      a.reference,
      a.id_abonnement_precedent,
      ca.niveau + 1
    FROM Abonnement a
    INNER JOIN chaine_abos ca ON a.reference = ca.id_abonnement_precedent
    ) 
    SELECT 
      d.id,
      d.id_abonnement,
      d.reference_support,
      d.nom_fichier,
      d.url_chemin,
      d.type_document,
      d.date_upload,
      ca.niveau,
      CASE
        WHEN ca.niveau = 0 THEN 'Contrat actuel'
        ELSE 'Contrat precédent (' || d.id_abonnement || ')'
      END AS provenance,
      (ca.niveau = 0) AS est_actuel,
      c.raison_sociale AS nom_client
    FROM chaine_abos ca
    JOIN Document_Lie d ON d.id_abonnement = ca.reference
    LEFT JOIN Abonnement a ON d.id_abonnement = a.reference
    LEFT JOIN Client c ON a.id_client = c.id
    ORDER BY ca.niveau ASC, d.date_upload DESC;
    `;
    const { rows } = await db.query(query, [reference]);
    return rows;
  }
}

module.exports = DocumentModel;
