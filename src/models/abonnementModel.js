const db = require('../config/db');

class AbonnementModel {
  static async getAll() {
    const query = `
      SELECT a.*, a.reference_emplacement AS reference,
             cl.nom_client, cl.contact, cl.secteur_activite,
             e.id_format, e.id_type_support, e.id_localisation, e.id_categorie, e.quantite, e.statut AS statut_emplacement, e.observation,
             f.ref_format, ts.nom_type AS nom_type_support, l.nom_lieu, c.nom_categorie
      FROM Abonnement a
      LEFT JOIN Emplacement e ON a.reference_emplacement = e.reference
      LEFT JOIN Format f ON e.id_format = f.id
      LEFT JOIN TypeSupport ts ON e.id_type_support = ts.id
      LEFT JOIN Localisation l ON e.id_localisation = l.id
      LEFT JOIN Categorie c ON e.id_categorie = c.id
      LEFT JOIN Client cl ON a.id_client = cl.id
      ORDER BY a.id ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(id) {
    const query = `
      SELECT a.*, a.reference_emplacement AS reference,
             cl.nom_client, cl.contact, cl.secteur_activite,
             e.id_format, e.id_type_support, e.id_localisation, e.id_categorie, e.quantite, e.statut AS statut_emplacement, e.observation,
             f.ref_format, ts.nom_type AS nom_type_support, l.nom_lieu, c.nom_categorie
      FROM Abonnement a
      LEFT JOIN Emplacement e ON a.reference_emplacement = e.reference
      LEFT JOIN Format f ON e.id_format = f.id
      LEFT JOIN TypeSupport ts ON e.id_type_support = ts.id
      LEFT JOIN Localisation l ON e.id_localisation = l.id
      LEFT JOIN Categorie c ON e.id_categorie = c.id
      LEFT JOIN Client cl ON a.id_client = cl.id
      WHERE a.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ id, date_debut, date_fin, duree_contrat, ref_facture, reference_emplacement, reference, id_client }) {
    let nextId = id;
    if (!nextId) {
      const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM Abonnement');
      nextId = parseInt(maxRows[0].next_id, 10);
    }
    const targetRef = reference_emplacement || reference;
    const query = `
      INSERT INTO Abonnement (id, date_debut, date_fin, duree_contrat, ref_facture, reference_emplacement, id_client)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      nextId,
      date_debut,
      date_fin,
      duree_contrat || null,
      ref_facture || null,
      targetRef,
      parseInt(id_client, 10)
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async update(id, { date_debut, date_fin, duree_contrat, ref_facture, reference_emplacement, reference, id_client }) {
    const targetRef = reference_emplacement || reference;
    const query = `
      UPDATE Abonnement
      SET date_debut = $1, date_fin = $2, duree_contrat = $3, ref_facture = $4, reference_emplacement = $5, id_client = $6
      WHERE id = $7
      RETURNING *
    `;
    const values = [
      date_debut,
      date_fin,
      duree_contrat || null,
      ref_facture || null,
      targetRef,
      parseInt(id_client, 10),
      id
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Abonnement WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = AbonnementModel;
