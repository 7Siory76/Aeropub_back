const db = require('../config/db');

class ActionCommercialeModel {
  static async getAll(filters = {}) {
    const { limit, offset, id_abonnement, id_client, id_utilisateur, type_action } = filters;
    const conditions = [];
    const params = [];

    if (id_abonnement) {
      params.push(String(id_abonnement).trim());
      conditions.push(`ac.id_abonnement = $${params.length}`);
    }

    if (id_client) {
      params.push(parseInt(id_client, 10));
      conditions.push(`ac.id_client = $${params.length}`);
    }

    if (id_utilisateur) {
      params.push(parseInt(id_utilisateur, 10));
      conditions.push(`ac.id_utilisateur = $${params.length}`);
    }

    if (type_action) {
      params.push(String(type_action).trim());
      conditions.push(`LOWER(ac.type_action) = LOWER($${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let paginationClause = '';
    if (limit !== undefined && !isNaN(Number(limit))) {
      params.push(parseInt(limit, 10));
      paginationClause += ` LIMIT $${params.length}`;
      if (offset !== undefined && !isNaN(Number(offset))) {
        params.push(parseInt(offset, 10));
        paginationClause += ` OFFSET $${params.length}`;
      }
    }

    const query = `
      SELECT 
        ac.id,
        ac.id_abonnement,
        ac.id_client,
        ac.id_utilisateur,
        ac.type_action,
        ac.date_action,
        ac.description,
        ac.statut_envoi_email,
        u.nom AS nom_commercial,
        u.email AS email_commercial,
        c.raison_sociale AS nom_client,
        a.annonceur_campagne,
        a.date_echeance,
        a.tarif,
        a.devise
      FROM Action_Commerciale ac
      LEFT JOIN Utilisateur u ON ac.id_utilisateur = u.id
      LEFT JOIN Client c ON ac.id_client = c.id
      LEFT JOIN Abonnement a ON ac.id_abonnement = a.reference
      ${whereClause}
      ORDER BY ac.date_action DESC
      ${paginationClause}
    `;
    const { rows } = await db.query(query, params);
    return rows;
  }

  static async getById(id) {
    const query = `
      SELECT 
        ac.id,
        ac.id_abonnement,
        ac.id_client,
        ac.id_utilisateur,
        ac.type_action,
        ac.date_action,
        ac.description,
        ac.statut_envoi_email,
        u.nom AS nom_commercial,
        c.raison_sociale AS nom_client,
        a.annonceur_campagne
      FROM Action_Commerciale ac
      LEFT JOIN Utilisateur u ON ac.id_utilisateur = u.id
      LEFT JOIN Client c ON ac.id_client = c.id
      LEFT JOIN Abonnement a ON ac.id_abonnement = a.reference
      WHERE ac.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  static async create({ id_abonnement, id_client, id_utilisateur, type_action, description, statut_envoi_email }) {
    const query = `
      INSERT INTO Action_Commerciale (id_abonnement, id_client, id_utilisateur, type_action, description, statut_envoi_email)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      id_abonnement || null,
      id_client ? parseInt(id_client, 10) : null,
      parseInt(id_utilisateur || 1, 10),
      type_action || 'Relance',
      description || null,
      statut_envoi_email || 'En attente'
    ];
    const { rows } = await db.query(query, values);
    return this.getById(rows[0].id);
  }

  static async update(id, { type_action, description, statut_envoi_email }) {
    const query = `
      UPDATE Action_Commerciale
      SET type_action = COALESCE($1, type_action),
          description = COALESCE($2, description),
          statut_envoi_email = COALESCE($3, statut_envoi_email)
      WHERE id = $4
      RETURNING *
    `;
    const values = [type_action || null, description || null, statut_envoi_email || null, id];
    const { rows } = await db.query(query, values);
    return this.getById(id);
  }

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM Action_Commerciale WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = ActionCommercialeModel;
