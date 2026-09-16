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

  static async checkSupportConflict({ supportRef, excludeAboRef, dateDebut, dateFin }) {
    if (!supportRef || !dateDebut || !dateFin) return null;

    const query = `
      SELECT 
        a.reference, 
        a.date_debut, 
        a.date_echeance, 
        cl.raison_sociale
      FROM Abonnement a
      JOIN Abonnement_Support asup ON asup.id_abonnement = a.reference
      LEFT JOIN Client cl ON cl.id = a.id_client
      LEFT JOIN LATERAL (
        SELECT tsa.nom_statut
        FROM Statut_Abonnement sa
        JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
        WHERE sa.id_abonnement = a.reference
        ORDER BY sa.date_debut DESC, sa.id DESC
        LIMIT 1
      ) st ON true
      WHERE asup.reference_support = $1
        AND ($2::text IS NULL OR a.reference != $2)
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%archiv%'
        AND COALESCE(st.nom_statut, 'actif') NOT ILIKE '%r_sili%'
        AND a.date_debut <= $4
        AND a.date_echeance >= $3
      LIMIT 1
    `;

    const res = await db.query(query, [
      supportRef,
      excludeAboRef || null,
      dateDebut,
      dateFin
    ]);

    if (res.rows.length > 0) {
      return res.rows[0];
    }
    return null;
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

    const allSupports = [];
    if (reference_support) allSupports.push(reference_support);
    if (reference_emplacement && !allSupports.includes(reference_emplacement)) allSupports.push(reference_emplacement);
    if (Array.isArray(supports)) {
      supports.forEach(s => {
        const refStr = typeof s === 'string' ? s.trim() : (s.reference_support || s.reference || '').trim();
        if (refStr && !allSupports.includes(refStr)) allSupports.push(refStr);
      });
    }

    for (const supRef of allSupports) {
      const conflict = await this.checkSupportConflict({
        supportRef: supRef,
        excludeAboRef: null,
        dateDebut: finalDateDebut,
        dateFin: finalDateEcheance
      });
      if (conflict) {
        const debutStr = new Date(conflict.date_debut).toLocaleDateString('fr-FR');
        const finStr = new Date(conflict.date_echeance).toLocaleDateString('fr-FR');
        const error = new Error(
          `Conflit de dates : le support "${supRef}" n'est pas disponible du ${new Date(finalDateDebut).toLocaleDateString('fr-FR')} au ${new Date(finalDateEcheance).toLocaleDateString('fr-FR')} (déjà réservé du ${debutStr} au ${finStr} par ${conflict.raison_sociale || 'Contrat ' + conflict.reference}).`
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

    for (const supRef of allSupports) {
      await db.query(`
        INSERT INTO Abonnement_Support (id_abonnement, reference_support)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [finalRef, supRef]);
    }

    const resolvedIdStatut = await this.resolveIdTypeStatut(id_type_statut || statut || 3);
    await db.query(`
      INSERT INTO Statut_Abonnement (id_abonnement, id_type_statut, date_debut, commentaire)
      VALUES ($1, $2, CURRENT_TIMESTAMP, 'Création du contrat')
    `, [finalRef, resolvedIdStatut]);

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
    reference_emplacement,
    supports
  }) {
    const currentAbo = await this.getById(reference);
    if (!currentAbo) {
      const error = new Error(`Abonnement "${reference}" introuvable.`);
      error.statusCode = 404;
      throw error;
    }

    const targetDateDebut = date_debut || currentAbo.date_debut;
    const targetDateFin = date_echeance || date_fin || currentAbo.date_echeance || currentAbo.date_fin;

    if (supports !== undefined && Array.isArray(supports)) {
      const currentStatut = String(currentAbo.statut_abonnement || currentAbo.statut || '').trim().toLowerCase();
      const isLocked = currentStatut.includes('actif') || currentStatut.includes('archiv');

      const currentSupportsRows = await db.query(
        'SELECT reference_support FROM Abonnement_Support WHERE id_abonnement = $1',
        [reference]
      );
      const currentSupList = currentSupportsRows.rows.map(r => r.reference_support).sort();
      const newSupList = [...new Set(supports.map(s => String(s).trim()).filter(Boolean))].sort();

      const hasChanged = JSON.stringify(currentSupList) !== JSON.stringify(newSupList);

      if (hasChanged && isLocked) {
        const error = new Error(
          "L'abonnement est déjà actif (ou archivé) : la modification des supports liés requiert une autorisation de l'administrateur."
        );
        error.statusCode = 403;
        throw error;
      }

      for (const supRef of newSupList) {
        const conflict = await this.checkSupportConflict({
          supportRef: supRef,
          excludeAboRef: reference,
          dateDebut: targetDateDebut,
          dateFin: targetDateFin
        });
        if (conflict) {
          const debutStr = new Date(conflict.date_debut).toLocaleDateString('fr-FR');
          const finStr = new Date(conflict.date_echeance).toLocaleDateString('fr-FR');
          const error = new Error(
            `Le support "${supRef}" n'est pas disponible entre le ${new Date(targetDateDebut).toLocaleDateString('fr-FR')} et le ${new Date(targetDateFin).toLocaleDateString('fr-FR')} : déjà réservé du ${debutStr} au ${finStr} par ${conflict.raison_sociale || 'Contrat ' + conflict.reference}.`
          );
          error.statusCode = 409;
          throw error;
        }
      }

      if (hasChanged) {
        await db.query('DELETE FROM Abonnement_Support WHERE id_abonnement = $1', [reference]);
        for (const supRef of newSupList) {
          await db.query(
            'INSERT INTO Abonnement_Support (id_abonnement, reference_support) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [reference, supRef]
          );
        }
      }
    } else {
      const supRef = reference_support || reference_emplacement;
      if (supRef) {
        const conflict = await this.checkSupportConflict({
          supportRef: supRef,
          excludeAboRef: reference,
          dateDebut: targetDateDebut,
          dateFin: targetDateFin
        });
        if (conflict) {
          const debutStr = new Date(conflict.date_debut).toLocaleDateString('fr-FR');
          const finStr = new Date(conflict.date_echeance).toLocaleDateString('fr-FR');
          const error = new Error(
            `Le support "${supRef}" n'est pas disponible entre le ${new Date(targetDateDebut).toLocaleDateString('fr-FR')} et le ${new Date(targetDateFin).toLocaleDateString('fr-FR')} : déjà réservé du ${debutStr} au ${finStr} par ${conflict.raison_sociale || 'Contrat ' + conflict.reference}.`
          );
          error.statusCode = 409;
          throw error;
        }

        await db.query(`
          INSERT INTO Abonnement_Support (id_abonnement, reference_support)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [reference, supRef]);
      } else if (date_debut || date_echeance || date_fin) {
        const currentSupportsRows = await db.query(
          'SELECT reference_support FROM Abonnement_Support WHERE id_abonnement = $1',
          [reference]
        );
        for (const row of currentSupportsRows.rows) {
          const conflict = await this.checkSupportConflict({
            supportRef: row.reference_support,
            excludeAboRef: reference,
            dateDebut: targetDateDebut,
            dateFin: targetDateFin
          });
          if (conflict) {
            const debutStr = new Date(conflict.date_debut).toLocaleDateString('fr-FR');
            const finStr = new Date(conflict.date_echeance).toLocaleDateString('fr-FR');
            const error = new Error(
              `Le support "${row.reference_support}" est déjà réservé du ${debutStr} au ${finStr} par ${conflict.raison_sociale || 'Contrat ' + conflict.reference}. Impossible de modifier les dates du contrat.`
            );
            error.statusCode = 409;
            throw error;
          }
        }
      }
    }

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
