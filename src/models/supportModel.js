const db = require('../config/db');

class SupportModel {
  static async getAll() {
    const query = `
      SELECT 
        s.reference,
        s.id_zone,
        s.id_categorie,
        s.id_type,
        s.id_type AS id_type_support,
        s.caracteristiques,
        s.caracteristiques AS ref_format,
        ts.nom AS nom_type_support,
        ts.nom AS nom_type,
        cs.nom AS nom_categorie,
        zt.nom_zone,
        zt.nom_zone AS nom_lieu,
        zt.id AS id_localisation,
        zt.id_aeroport,
        zt.id_perimetre,
        aero.nom AS nom_aeroport,
        peri.nom AS nom_perimetre,
        CONCAT(aero.nom, ' - ', peri.nom) AS type_zone,
        COALESCE(es.etat, 'Disponible') AS statut,
        COALESCE(es.etat, 'Disponible') AS etat,
        es.observation,
        es.date_debut AS date_etat,
        1 AS quantite
      FROM Support s
      LEFT JOIN Zone_Terminal zt ON s.id_zone = zt.id
      LEFT JOIN Aeroport aero ON zt.id_aeroport = aero.id
      LEFT JOIN Perimetre peri ON zt.id_perimetre = peri.id
      LEFT JOIN Categorie_Support cs ON s.id_categorie = cs.id
      LEFT JOIN Type_Support ts ON s.id_type = ts.id
      LEFT JOIN LATERAL (
        SELECT etat, observation, date_debut, id_utilisateur
        FROM Etat_Support
        WHERE reference_support = s.reference
        ORDER BY date_debut DESC, id DESC
        LIMIT 1
      ) es ON true
      ORDER BY s.reference ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getByReference(reference) {
    const query = `
      SELECT 
        s.reference,
        s.id_zone,
        s.id_categorie,
        s.id_type,
        s.id_type AS id_type_support,
        s.caracteristiques,
        s.caracteristiques AS ref_format,
        ts.nom AS nom_type_support,
        ts.nom AS nom_type,
        cs.nom AS nom_categorie,
        zt.nom_zone,
        zt.nom_zone AS nom_lieu,
        zt.id AS id_localisation,
        zt.id_aeroport,
        zt.id_perimetre,
        aero.nom AS nom_aeroport,
        peri.nom AS nom_perimetre,
        CONCAT(aero.nom, ' - ', peri.nom) AS type_zone,
        COALESCE(es.etat, 'Disponible') AS statut,
        COALESCE(es.etat, 'Disponible') AS etat,
        es.observation,
        es.date_debut AS date_etat,
        1 AS quantite
      FROM Support s
      LEFT JOIN Zone_Terminal zt ON s.id_zone = zt.id
      LEFT JOIN Aeroport aero ON zt.id_aeroport = aero.id
      LEFT JOIN Perimetre peri ON zt.id_perimetre = peri.id
      LEFT JOIN Categorie_Support cs ON s.id_categorie = cs.id
      LEFT JOIN Type_Support ts ON s.id_type = ts.id
      LEFT JOIN LATERAL (
        SELECT etat, observation, date_debut, id_utilisateur
        FROM Etat_Support
        WHERE reference_support = s.reference
        ORDER BY date_debut DESC, id DESC
        LIMIT 1
      ) es ON true
      WHERE s.reference = $1
    `;
    const { rows } = await db.query(query, [reference]);
    return rows[0];
  }

  static async create({ reference, id_zone, id_categorie, id_type, id_type_support, caracteristiques, statut, etat, observation, id_utilisateur }) {
    const finalType = id_type || id_type_support || 1;
    const finalZone = id_zone || 1;
    const finalCat = id_categorie || 1;
    const finalState = etat || statut || 'Disponible';

    // 1. Insérer le support
    const insertSupportQuery = `
      INSERT INTO Support (reference, id_zone, id_categorie, id_type, caracteristiques)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await db.query(insertSupportQuery, [
      reference,
      parseInt(finalZone, 10),
      parseInt(finalCat, 10),
      parseInt(finalType, 10),
      caracteristiques || null
    ]);

    // 2. Insérer l'état initial
    await db.query(`
      INSERT INTO Etat_Support (reference_support, etat, date_debut, id_utilisateur, observation)
      VALUES ($1, $2, NOW(), $3, $4)
    `, [reference, finalState, id_utilisateur || null, observation || null]);

    return this.getByReference(reference);
  }

  static async update(reference, { id_zone, id_categorie, id_type, id_type_support, caracteristiques, statut, etat, observation, id_utilisateur }) {
    // 1. Mettre à jour les champs techniques du support si fournis
    if (id_zone || id_categorie || id_type || id_type_support || caracteristiques !== undefined) {
      const current = await this.getByReference(reference);
      if (current) {
        await db.query(`
          UPDATE Support
          SET id_zone = COALESCE($1, id_zone),
              id_categorie = COALESCE($2, id_categorie),
              id_type = COALESCE($3, id_type),
              caracteristiques = COALESCE($4, caracteristiques)
          WHERE reference = $5
        `, [
          id_zone ? parseInt(id_zone, 10) : null,
          id_categorie ? parseInt(id_categorie, 10) : null,
          (id_type || id_type_support) ? parseInt(id_type || id_type_support, 10) : null,
          caracteristiques !== undefined ? caracteristiques : null,
          reference
        ]);
      }
    }

    // 2. Mettre à jour l'historique d'état si un nouvel état ou une observation est fournie
    const newState = etat || statut;
    if (newState || observation !== undefined) {
      // Clôturer l'état précédent actif
      await db.query(`
        UPDATE Etat_Support
        SET date_fin = NOW()
        WHERE reference_support = $1 AND date_fin IS NULL
      `, [reference]);

      // Insérer le nouvel état
      await db.query(`
        INSERT INTO Etat_Support (reference_support, etat, date_debut, id_utilisateur, observation)
        VALUES ($1, $2, NOW(), $3, $4)
      `, [
        reference,
        newState || 'Disponible',
        id_utilisateur || null,
        observation || null
      ]);
    }

    return this.getByReference(reference);
  }

  static async delete(reference) {
    await db.query('DELETE FROM Etat_Support WHERE reference_support = $1', [reference]);
    await db.query('DELETE FROM Abonnement_Support WHERE reference_support = $1', [reference]);
    const { rows } = await db.query('DELETE FROM Support WHERE reference = $1 RETURNING *', [reference]);
    return rows[0];
  }

  static async getHistoriqueEtats(reference) {
    const query = `
      SELECT es.*, u.nom AS nom_utilisateur
      FROM Etat_Support es
      LEFT JOIN Utilisateur u ON es.id_utilisateur = u.id
      WHERE es.reference_support = $1
      ORDER BY es.date_debut DESC
    `;
    const { rows } = await db.query(query, [reference]);
    return rows;
  }
}

module.exports = SupportModel;
