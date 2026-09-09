const db = require('../config/db');

class AbonnementModel {
  static async resolveIdTypeStatut(statutOrId) {
    if (!statutOrId) {
      const res = await db.query("SELECT id FROM Type_Statut_Abonnement WHERE LOWER(nom_statut) = 'actif' LIMIT 1");
      return res.rows[0]?.id || 3;
    }
    if (typeof statutOrId === 'number' || (!isNaN(Number(statutOrId)) && String(statutOrId).trim() !== '')) {
      return parseInt(statutOrId, 10);
    }
    const cleanNom = String(statutOrId).trim();
    const res = await db.query('SELECT id FROM Type_Statut_Abonnement WHERE LOWER(nom_statut) = LOWER($1) LIMIT 1', [cleanNom]);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    try {
      const created = await db.query('INSERT INTO Type_Statut_Abonnement (nom_statut) VALUES ($1) RETURNING id', [cleanNom]);
      return created.rows[0].id;
    } catch {
      const fallback = await db.query('SELECT id FROM Type_Statut_Abonnement LIMIT 1');
      return fallback.rows[0]?.id || 3;
    }
  }

  static async getAll() {
    const query = `
      SELECT 
        a.*,
        a.reference AS id,
        cl.raison_sociale,
        cl.raison_sociale AS nom_client,
        cl.etat_client,
        u.nom AS nom_commercial,
        u.email AS email_commercial,
        a.date_echeance AS date_fin,
        COALESCE(sup.supports_list, '') AS supports_associes,
        COALESCE(sup.first_support, '') AS reference_emplacement,
        COALESCE(st.statut, 'actif') AS statut_abonnement,
        COALESCE(st.statut, 'actif') AS statut,
        st.id_type_statut
      FROM Abonnement a
      LEFT JOIN Client cl ON a.id_client = cl.id
      LEFT JOIN Utilisateur u ON a.id_commercial = u.id
      LEFT JOIN LATERAL (
        SELECT 
          STRING_AGG(reference_support, ', ' ORDER BY reference_support) AS supports_list,
          (ARRAY_AGG(reference_support ORDER BY reference_support))[1] AS first_support
        FROM Abonnement_Support
        WHERE id_abonnement = a.reference
      ) sup ON true
      LEFT JOIN LATERAL (
        SELECT sa.id_type_statut, tsa.nom_statut AS statut, sa.commentaire, sa.date_debut
        FROM Statut_Abonnement sa
        LEFT JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
        WHERE sa.id_abonnement = a.reference
        ORDER BY sa.date_debut DESC, sa.id DESC
        LIMIT 1
      ) st ON true
      ORDER BY a.date_creation DESC, a.reference ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async getById(reference) {
    const query = `
      SELECT 
        a.*,
        a.reference AS id,
        cl.raison_sociale,
        cl.raison_sociale AS nom_client,
        cl.etat_client,
        u.nom AS nom_commercial,
        u.email AS email_commercial,
        a.date_echeance AS date_fin,
        COALESCE(sup.supports_list, '') AS supports_associes,
        COALESCE(sup.first_support, '') AS reference_emplacement,
        COALESCE(st.statut, 'actif') AS statut_abonnement,
        COALESCE(st.statut, 'actif') AS statut,
        st.id_type_statut
      FROM Abonnement a
      LEFT JOIN Client cl ON a.id_client = cl.id
      LEFT JOIN Utilisateur u ON a.id_commercial = u.id
      LEFT JOIN LATERAL (
        SELECT 
          STRING_AGG(reference_support, ', ' ORDER BY reference_support) AS supports_list,
          (ARRAY_AGG(reference_support ORDER BY reference_support))[1] AS first_support
        FROM Abonnement_Support
        WHERE id_abonnement = a.reference
      ) sup ON true
      LEFT JOIN LATERAL (
        SELECT sa.id_type_statut, tsa.nom_statut AS statut, sa.commentaire, sa.date_debut
        FROM Statut_Abonnement sa
        LEFT JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
        WHERE sa.id_abonnement = a.reference
        ORDER BY sa.date_debut DESC, sa.id DESC
        LIMIT 1
      ) st ON true
      WHERE a.reference = $1 OR CAST(a.id_client AS VARCHAR) = $1
    `;
    const { rows } = await db.query(query, [String(reference)]);
    return rows[0];
  }

  static async create({
    reference,
    id_client,
    id_commercial,
    id_abonnement_precedent,
    annonceur_campagne,
    tarif,
    devise,
    periodicite,
    date_debut,
    date_echeance,
    date_fin,
    reconduction_tacite,
    preavis_jours,
    probabilite_renouvellement,
    motif_non_renouvellement,
    id_type_statut,
    statut,
    reference_support,
    reference_emplacement,
    supports = []
  }) {
    // Génération automatique d'une référence si non spécifiée
    let finalRef = reference;
    if (!finalRef) {
      const year = new Date().getFullYear();
      const countRes = await db.query('SELECT COUNT(*) AS total FROM Abonnement');
      const seq = String(parseInt(countRes.rows[0].total, 10) + 1).padStart(3, '0');
      finalRef = `ABO-${year}-${seq}`;
    }

    const finalClient = parseInt(id_client, 10);
    const finalCommercial = id_commercial ? parseInt(id_commercial, 10) : 1;
    const finalTarif = parseFloat(tarif) || 0;
    const finalDateDebut = date_debut || new Date();
    const finalDateEcheance = date_echeance || date_fin || new Date();

    // Vérifier s'il y a un conflit sur le support
    const targetSupport = reference_support || reference_emplacement || (supports && supports[0]);
    if (targetSupport) {
      const checkConflictQuery = `
        SELECT 
          a.reference, 
          a.date_debut, 
          a.date_echeance, 
          cl.raison_sociale
        FROM Abonnement a
        JOIN Abonnement_Support asup ON asup.id_abonnement = a.reference
        LEFT JOIN Client cl ON cl.id = a.id_client
        WHERE asup.reference_support = $1
          AND a.date_debut <= $3
          AND a.date_echeance >= $2
        LIMIT 1
      `;

      const conflictRes = await db.query(checkConflictQuery, [
        targetSupport,
        finalDateDebut,
        finalDateEcheance
      ]);

      if (conflictRes.rows.length > 0) {
        const conflict = conflictRes.rows[0];
        const debutStr = new Date(conflict.date_debut).toLocaleDateString('fr-FR');
        const finStr = new Date(conflict.date_echeance).toLocaleDateString('fr-FR');
        const error = new Error(
          `Conflit de dates : le support ${targetSupport} est déjà réservé du ${debutStr} au ${finStr} (${conflict.raison_sociale || 'Contrat ' + conflict.reference}).`
        );
        error.statusCode = 409;
        throw error;
      }
    }

    const insertAboQuery = `
      INSERT INTO Abonnement (
        reference, id_client, id_commercial, id_abonnement_precedent,
        annonceur_campagne, tarif, devise, periodicite, date_debut,
        date_echeance, reconduction_tacite, preavis_jours,
        probabilite_renouvellement, motif_non_renouvellement
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    await db.query(insertAboQuery, [
      finalRef,
      finalClient,
      finalCommercial,
      id_abonnement_precedent || null,
      annonceur_campagne || null,
      finalTarif,
      devise || 'MGA',
      periodicite || 'Annuel',
      finalDateDebut,
      finalDateEcheance,
      reconduction_tacite === true || reconduction_tacite === 'true',
      preavis_jours ? parseInt(preavis_jours, 10) : 30,
      probabilite_renouvellement ? parseInt(probabilite_renouvellement, 10) : 80,
      motif_non_renouvellement || null
    ]);

    // Lier les supports
    const allSupports = [];
    if (reference_support) allSupports.push(reference_support);
    if (reference_emplacement && !allSupports.includes(reference_emplacement)) allSupports.push(reference_emplacement);
    if (Array.isArray(supports)) {
      supports.forEach(s => { if (s && !allSupports.includes(s)) allSupports.push(s); });
    }

    for (const supRef of allSupports) {
      await db.query(`
        INSERT INTO Abonnement_Support (id_abonnement, reference_support)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [finalRef, supRef]);
    }

    // Initialiser le statut d'abonnement
    const resolvedIdStatut = await this.resolveIdTypeStatut(id_type_statut || statut || 'actif');
    await db.query(`
      INSERT INTO Statut_Abonnement (id_abonnement, id_type_statut, date_debut, id_utilisateur, commentaire)
      VALUES ($1, $2, NOW(), $3, 'Création initiale du contrat')
    `, [finalRef, resolvedIdStatut, finalCommercial]);

    return this.getById(finalRef);
  }

  static async update(reference, {
    id_client,
    id_commercial,
    annonceur_campagne,
    tarif,
    devise,
    periodicite,
    date_debut,
    date_echeance,
    date_fin,
    reconduction_tacite,
    preavis_jours,
    probabilite_renouvellement,
    motif_non_renouvellement,
    id_type_statut,
    statut,
    reference_support,
    reference_emplacement
  }) {
    const finalDateEcheance = date_echeance || date_fin;

    await db.query(`
      UPDATE Abonnement
      SET id_client = COALESCE($1, id_client),
          id_commercial = COALESCE($2, id_commercial),
          annonceur_campagne = COALESCE($3, annonceur_campagne),
          tarif = COALESCE($4, tarif),
          devise = COALESCE($5, devise),
          periodicite = COALESCE($6, periodicite),
          date_debut = COALESCE($7, date_debut),
          date_echeance = COALESCE($8, date_echeance),
          reconduction_tacite = COALESCE($9, reconduction_tacite),
          preavis_jours = COALESCE($10, preavis_jours),
          probabilite_renouvellement = COALESCE($11, probabilite_renouvellement),
          motif_non_renouvellement = COALESCE($12, motif_non_renouvellement)
      WHERE reference = $13
    `, [
      id_client ? parseInt(id_client, 10) : null,
      id_commercial ? parseInt(id_commercial, 10) : null,
      annonceur_campagne !== undefined ? annonceur_campagne : null,
      tarif !== undefined ? parseFloat(tarif) : null,
      devise || null,
      periodicite || null,
      date_debut || null,
      finalDateEcheance || null,
      reconduction_tacite !== undefined ? (reconduction_tacite === true || reconduction_tacite === 'true') : null,
      preavis_jours !== undefined ? parseInt(preavis_jours, 10) : null,
      probabilite_renouvellement !== undefined ? parseInt(probabilite_renouvellement, 10) : null,
      motif_non_renouvellement !== undefined ? motif_non_renouvellement : null,
      reference
    ]);

    // Mettre à jour le support lié si spécifié
    const supRef = reference_support || reference_emplacement;
    if (supRef) {
      await db.query(`
        INSERT INTO Abonnement_Support (id_abonnement, reference_support)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [reference, supRef]);
    }

    // Mettre à jour le statut si spécifié
    const newStatut = id_type_statut || statut;
    if (newStatut) {
      const resolvedIdStatut = await this.resolveIdTypeStatut(newStatut);
      await db.query(`
        INSERT INTO Statut_Abonnement (id_abonnement, id_type_statut, date_debut, commentaire)
        VALUES ($1, $2, NOW(), 'Mise à jour statut')
      `, [reference, resolvedIdStatut]);
    }

    return this.getById(reference);
  }

  static async delete(reference) {
    await db.query('DELETE FROM Statut_Abonnement WHERE id_abonnement = $1', [reference]);
    await db.query('DELETE FROM Abonnement_Support WHERE id_abonnement = $1', [reference]);
    await db.query('DELETE FROM Action_Commerciale WHERE id_abonnement = $1', [reference]);
    await db.query('DELETE FROM Document_Lie WHERE id_abonnement = $1', [reference]);
    const { rows } = await db.query('DELETE FROM Abonnement WHERE reference = $1 RETURNING *', [reference]);
    return rows[0];
  }

  static async getSupportsByAbonnement(reference) {
    const query = `
      SELECT s.*, ts.nom AS nom_type_support, zt.nom_zone
      FROM Abonnement_Support asup
      JOIN Support s ON asup.reference_support = s.reference
      LEFT JOIN Type_Support ts ON s.id_type = ts.id
      LEFT JOIN Zone_Terminal zt ON s.id_zone = zt.id
      WHERE asup.id_abonnement = $1
    `;
    const { rows } = await db.query(query, [reference]);
    return rows;
  }
}

module.exports = AbonnementModel;
