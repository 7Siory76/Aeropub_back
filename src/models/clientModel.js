const db = require('../config/db');

class ClientModel {
  static async getAll() {
    const query = `
      SELECT 
        c.*,
        c.raison_sociale AS nom_client,
        COALESCE(ct.contacts_val, 'Aucun contact') AS contact,
        ct.nom_contact_principal,
        ct.valeur_contact_principal,
        COALESCE(ct.total_contacts, 0) AS total_contacts
      FROM Client c
      LEFT JOIN LATERAL (
        SELECT 
          STRING_AGG(valeur, ', ') AS contacts_val,
          (ARRAY_AGG(nom_contact ORDER BY est_principal DESC, id ASC))[1] AS nom_contact_principal,
          (ARRAY_AGG(valeur ORDER BY est_principal DESC, id ASC))[1] AS valeur_contact_principal,
          COUNT(*) AS total_contacts
        FROM Contact
        WHERE id_client = c.id
      ) ct ON true
      ORDER BY c.raison_sociale ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(id) {
    const query = `
      SELECT 
        c.*,
        c.raison_sociale AS nom_client,
        COALESCE(ct.contacts_val, 'Aucun contact') AS contact,
        ct.nom_contact_principal,
        ct.valeur_contact_principal
      FROM Client c
      LEFT JOIN LATERAL (
        SELECT 
          STRING_AGG(valeur, ', ') AS contacts_val,
          (ARRAY_AGG(nom_contact ORDER BY est_principal DESC, id ASC))[1] AS nom_contact_principal,
          (ARRAY_AGG(valeur ORDER BY est_principal DESC, id ASC))[1] AS valeur_contact_principal
        FROM Contact
        WHERE id_client = c.id
      ) ct ON true
      WHERE c.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ id, raison_sociale, nom_client, adresse_postale, adresse_facturation, etat_client, contact, nom_contact }) {
    const finalNom = raison_sociale || nom_client || 'Nouveau Client';
    const insertQuery = `
      INSERT INTO Client (raison_sociale, adresse_postale, adresse_facturation, etat_client)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      finalNom,
      adresse_postale || null,
      adresse_facturation || null,
      etat_client || 'Actif'
    ];
    const { rows } = await db.query(insertQuery, values);
    const newClient = rows[0];

    // Si un contact est fourni, l'insérer dans la table Contact
    if (contact || nom_contact) {
      await db.query(`
        INSERT INTO Contact (id_client, nom_contact, valeur, est_principal)
        VALUES ($1, $2, $3, TRUE)
      `, [newClient.id, nom_contact || 'Contact Principal', contact || 'N/A']);
    }

    return this.getById(newClient.id);
  }

  static async update(id, { raison_sociale, nom_client, adresse_postale, adresse_facturation, etat_client, contact, nom_contact }) {
    const finalNom = raison_sociale || nom_client;
    await db.query(`
      UPDATE Client
      SET raison_sociale = COALESCE($1, raison_sociale),
          adresse_postale = COALESCE($2, adresse_postale),
          adresse_facturation = COALESCE($3, adresse_facturation),
          etat_client = COALESCE($4, etat_client)
      WHERE id = $5
    `, [
      finalNom || null,
      adresse_postale !== undefined ? adresse_postale : null,
      adresse_facturation !== undefined ? adresse_facturation : null,
      etat_client || null,
      id
    ]);

    if (contact) {
      // Upsert contact principal
      const existContact = await db.query('SELECT id FROM Contact WHERE id_client = $1 AND est_principal = TRUE', [id]);
      if (existContact.rows.length > 0) {
        await db.query('UPDATE Contact SET valeur = $1, nom_contact = COALESCE($2, nom_contact) WHERE id = $3', [
          contact,
          nom_contact || null,
          existContact.rows[0].id
        ]);
      } else {
        await db.query('INSERT INTO Contact (id_client, nom_contact, valeur, est_principal) VALUES ($1, $2, $3, TRUE)', [
          id,
          nom_contact || 'Contact Principal',
          contact
        ]);
      }
    }

    return this.getById(id);
  }

  static async delete(id) {
    await db.query('DELETE FROM Contact WHERE id_client = $1', [id]);
    await db.query('DELETE FROM Action_Commerciale WHERE id_client = $1', [id]);
    await db.query('DELETE FROM Document_Lie WHERE id_client = $1', [id]);
    const { rows } = await db.query('DELETE FROM Client WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }

  static async getContacts(clientId) {
    const { rows } = await db.query('SELECT * FROM Contact WHERE id_client = $1 ORDER BY est_principal DESC, id ASC', [clientId]);
    return rows;
  }
}

module.exports = ClientModel;
