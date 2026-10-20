const cron = require('node-cron');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const AbonnementModel = require('../models/abonnementModel');
const JournalNotificationModel = require('../models/journalNotificationModel');
const ActionCommercialeModel = require('../models/actionCommercialeModel');
const ActionCommercialeService = require('./actionCommercialeService');

/**
 * 1. Vérifie les échéances à 90j, 30j, 15j et 7j et envoie une alerte dans Journal_Notification
 *    Gère les pannes serveur ou jours manqués : si le palier n'a pas été notifié,
 *    l'alerte est envoyée avec le nombre de jours exact restant (ex: 25j pour le palier 30j).
 */
async function verifierAlertesEcheances() {
  try {
    console.log('[CRON] Vérification des alertes d’échéance (90j, 30j, 15j, 7j)...');

    // Sélectionner les contrats actifs arrivant à terme qui n'ont AUCUN renouvellement
    const query = `
          SELECT 
            a.reference, 
            a.id_commercial,
            a.date_echeance AS date_terme,
            a.reconduction_tacite,
            a.preavis_jours,
            cl.raison_sociale AS nom_client,
            u.nom AS nom_commercial
          FROM Abonnement a
          LEFT JOIN Client cl ON a.id_client = cl.id
          LEFT JOIN Utilisateur u ON a.id_commercial = u.id
          LEFT JOIN LATERAL (
            SELECT sa.id_type_statut, tsa.nom_statut AS statut
            FROM Statut_Abonnement sa
            LEFT JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
            WHERE sa.id_abonnement = a.reference
            ORDER BY sa.id DESC LIMIT 1
          ) st ON true
          WHERE 
            -- Contrat encore en cours (date future)
            (a.date_echeance > CURRENT_TIMESTAMP)
            -- Dernier statut actif
            AND LOWER(COALESCE(st.statut, 'actif')) = 'actif'
            -- Aucun renouvellement enregistré
            AND NOT EXISTS (
              SELECT 1 FROM Abonnement child 
              WHERE child.id_abonnement_precedent = a.reference
            )
        `;

    const { rows: contratsActifs } = await db.query(query);
    const now = new Date();

    for (const abo of contratsActifs) {
      const dateTerme = new Date(abo.date_terme);
      // Calcul du nombre de jours restants jusqu'à l'échéance
      const diffJours = Math.ceil((dateTerme.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Si déjà échu ou aujourd'hui même, sera géré par l'expiration
      if (diffJours <= 0) continue;

      // Déterminer le palier correspondant
      let palier = null;
      if (diffJours <= 7) {
        palier = 7;
      } else if (diffJours <= 15) {
        palier = 15;
      } else if (diffJours <= 30) {
        palier = 30;
      } else if (diffJours <= 90) {
        palier = 90;
      }

      // Si hors des 90 jours, pas d'alerte nécessaire
      if (!palier) continue;

      // Vérifier si une alerte pour ce palier précis a déjà été envoyée pour ce contrat
      const checkAlerte = await db.query(`
        SELECT id FROM Journal_Notification
        WHERE reference_entite = $1
          AND categorie_action = 'ECHEANCE'
          AND (valeur_apres ->> 'palier') = $2
        LIMIT 1
      `, [abo.reference, String(palier)]);

      // Si l'alerte n'a pas encore été envoyée pour ce palier
      if (checkAlerte.rows.length === 0) {
        const dateFr = dateTerme.toLocaleDateString('fr-FR');
        const clientInfo = abo.nom_client ? ` (${abo.nom_client})` : '';
        const isTacite = abo.reconduction_tacite === true || abo.reconduction_tacite === 'true' || abo.reconduction_tacite === 1;
        const typeInfo = isTacite ? ` [Reconduction tacite - préavis ${abo.preavis_jours || 30}j]` : '';

        await JournalNotificationModel.logAction({
          id_utilisateur: abo.id_commercial || null,
          categorie_action: 'ECHEANCE',
          entite_concernee: 'ABONNEMENT',
          reference_entite: abo.reference,
          valeur_apres: {
            palier: palier,
            diffJours: diffJours,
            date_echeance: abo.date_terme,
            reconduction_tacite: isTacite,
            preavis_jours: abo.preavis_jours || 30
          },
          message_notification: `[Alerte J-${palier}] Le contrat ${abo.reference}${clientInfo} arrive à échéance dans ${diffJours} jour(s) (le ${dateFr})${typeInfo}. Aucun renouvellement enregistré.`
        });

        console.log(`[CRON] Alerte J-${palier} envoyée pour le contrat ${abo.reference} (reste ${diffJours} jour(s)).`);
      }
    }
  } catch (error) {
    console.error('[CRON] Erreur lors de la vérification des alertes d’échéance :', error);
  }
}

/**
 * 2. Renouvelle automatiquement un contrat sous clause de reconduction tacite
 *    - Calcule la nouvelle période selon la périodicité contractuelle
 *    - Crée le contrat enfant sous référence suivante avec id_abonnement_precedent
 *    - Transfère les supports du parent et maintient leur état 'occupé'
 *    - Clôture l'ancien contrat en statut 'renouvelé'
 *    - Trace l'événement dans Action_Commerciale et dans Journal_Notification (audit)
 */
async function renouvelerContratTacitement(abo) {
  try {
    console.log(`[CRON - RECONDUCTION] Démarrage du renouvellement automatique pour ${abo.reference}...`);

    const newDateDebut = new Date(abo.date_echeance);
    const periodiciteClean = (abo.periodicite || '').trim().toLowerCase();
    let newDateEcheance = new Date(newDateDebut);

    if (periodiciteClean.includes('mensuel') || periodiciteClean.includes('mois')) {
      newDateEcheance.setMonth(newDateEcheance.getMonth() + 1);
    } else if (periodiciteClean.includes('trimestr')) {
      newDateEcheance.setMonth(newDateEcheance.getMonth() + 3);
    } else if (periodiciteClean.includes('semestr')) {
      newDateEcheance.setMonth(newDateEcheance.getMonth() + 6);
    } else if (periodiciteClean.includes('annuel') || periodiciteClean.includes('an')) {
      newDateEcheance.setFullYear(newDateEcheance.getFullYear() + 1);
    } else {
      const dureeMs = new Date(abo.date_echeance).getTime() - new Date(abo.date_debut).getTime();
      if (dureeMs > 0) {
        newDateEcheance = new Date(newDateDebut.getTime() + dureeMs);
      } else {
        newDateEcheance.setFullYear(newDateEcheance.getFullYear() + 1);
      }
    }

    // Récupérer les supports associés au contrat parent
    const supportsRes = await db.query(
      'SELECT reference_support FROM Abonnement_Support WHERE id_abonnement = $1',
      [abo.reference]
    );
    const supportRefs = supportsRes.rows.map(r => r.reference_support);

    // A. Clôturer l'ancien statut du contrat parent et le basculer en "renouvelé"
    const idStatutRenouvele = await AbonnementModel.resolveIdTypeStatut('renouvelé');
    await db.query(`
      UPDATE Statut_Abonnement 
      SET date_fin = CURRENT_TIMESTAMP 
      WHERE id_abonnement = $1 AND (date_fin IS NULL OR date_fin > CURRENT_TIMESTAMP)
    `, [abo.reference]);

    await db.query(`
      INSERT INTO Statut_Abonnement (id_abonnement, id_type_statut, date_debut, date_fin, commentaire)
      VALUES ($1, $2, CURRENT_TIMESTAMP, NULL, $3)
    `, [
      abo.reference,
      idStatutRenouvele,
      `[Automatisme CRON] Contrat reconduit tacitement suite à l'échéance du ${new Date(abo.date_echeance).toLocaleDateString('fr-FR')}.`
    ]);

    // B. Création du nouveau contrat renouvelé (enfant)
    const newAbo = await AbonnementModel.create({
      id_client: abo.id_client,
      id_commercial: abo.id_commercial || 1,
      id_abonnement_precedent: abo.reference,
      annonceur_campagne: abo.annonceur_campagne || null,
      tarif: abo.tarif,
      devise: abo.devise || 'MGA',
      periodicite: abo.periodicite || 'Annuel',
      date_debut: newDateDebut,
      date_echeance: newDateEcheance,
      reconduction_tacite: true,
      preavis_jours: abo.preavis_jours ? parseInt(abo.preavis_jours, 10) : 30,
      statut: 'actif',
      supports: supportRefs
    });

    const newRef = newAbo.reference;
    const dateEcheanceFr = new Date(abo.date_echeance).toLocaleDateString('fr-FR');
    const newDateDebutFr = newDateDebut.toLocaleDateString('fr-FR');
    const newDateEcheanceFr = newDateEcheance.toLocaleDateString('fr-FR');

    // C. Mettre à jour le commentaire du contrat parent avec la référence générée
    await db.query(`
      UPDATE Statut_Abonnement 
      SET commentaire = $1
      WHERE id_abonnement = $2 AND id_type_statut = $3 AND date_fin IS NULL
    `, [
      `[Automatisme CRON] Contrat reconduit tacitement avec succès vers ${newRef}.`,
      abo.reference,
      idStatutRenouvele
    ]);

    // D. Enregistrement dans Action_Commerciale (pour le contrat précédent et le nouveau contrat)
    await ActionCommercialeModel.create({
      id_abonnement: abo.reference,
      id_client: abo.id_client,
      id_utilisateur: abo.id_commercial || 1,
      type_action: 'Reconduction Tacite',
      description: `Reconduction tacite automatique exécutée à l'échéance du ${dateEcheanceFr}. Le contrat a été renouvelé sous la nouvelle référence ${newRef} (Période : ${newDateDebutFr} au ${newDateEcheanceFr}).`,
      statut_envoi_email: 'Validé'
    });

    await ActionCommercialeModel.create({
      id_abonnement: newRef,
      id_client: abo.id_client,
      id_utilisateur: abo.id_commercial || 1,
      type_action: 'Reconduction Tacite',
      description: `Nouveau contrat généré automatiquement par reconduction tacite en succession du contrat ${abo.reference} (Période : ${newDateDebutFr} au ${newDateEcheanceFr}).`,
      statut_envoi_email: 'Validé'
    });

    // E. Journal d'audit (Journal_Notification)
    await JournalNotificationModel.logAction({
      id_utilisateur: abo.id_commercial || null,
      categorie_action: 'RECONDUCTION_TACITE_AUTO',
      entite_concernee: 'ABONNEMENT',
      reference_entite: newRef,
      valeur_apres: {
        action: 'reconduction_tacite_automatique',
        contrat_precedent: abo.reference,
        nouveau_contrat: newRef,
        date_debut: newDateDebut,
        date_echeance: newDateEcheance,
        periodicite: abo.periodicite,
        supports: supportRefs,
        client: abo.nom_client || abo.id_client
      },
      message_notification: `[Reconduction Tacite Automatique] Le contrat ${abo.reference} est arrivé à son terme le ${dateEcheanceFr} et a été automatiquement reconduit sous la référence ${newRef} jusqu'au ${newDateEcheanceFr}.`
    });

    await JournalNotificationModel.logAction({
      id_utilisateur: abo.id_commercial || null,
      categorie_action: 'STATUT',
      entite_concernee: 'ABONNEMENT',
      reference_entite: abo.reference,
      valeur_apres: {
        statut: 'renouvelé',
        nouveau_contrat: newRef
      },
      message_notification: `Le contrat ${abo.reference} a été clôturé avec le statut "renouvelé" suite à sa reconduction tacite automatique vers ${newRef}.`
    });

    console.log(`[CRON - RECONDUCTION] ✅ Contrat ${abo.reference} reconduit automatiquement vers ${newRef} !`);
    return newAbo;
  } catch (err) {
    console.error(`[CRON - RECONDUCTION] ❌ Erreur renouvellement automatique ${abo.reference} :`, err);
    throw err;
  }
}

/**
 * 2. Vérifie les contrats arrivés à échéance :
 *    - Si reconduction_tacite = TRUE -> Renouvellement automatique
 *    - Si non tacite -> Passage en "expiré" et libération des supports
 *    Historise toutes les actions dans Action_Commerciale et Journal_Notification.
 */
async function verifierEtExpirerAbonnements() {
  try {
    console.log('[CRON] Vérification des contrats arrivés à échéance (renouvellement auto ou expiration)...');

    // 1. Récupération de l'id du statut "expiré"
    const statutExpRes = await db.query(
      "SELECT id FROM Type_Statut_Abonnement WHERE LOWER(nom_statut) = 'expiré' OR " +
      "LOWER(nom_statut) = 'expire' LIMIT 1"
    );
    const idStatutExpire = statutExpRes.rows[0]?.id || 6;

    // 2. Sélectionner les abonnements échus sans renouvellement enregistré
    const query = `
          SELECT 
            a.reference, 
            a.id_client,
            a.id_commercial,
            a.date_debut,
            a.date_echeance,
            a.reconduction_tacite,
            a.preavis_jours,
            a.periodicite,
            a.tarif,
            a.devise,
            a.annonceur_campagne,
            cl.raison_sociale AS nom_client,
            st.statut AS dernier_statut
          FROM Abonnement a
          LEFT JOIN Client cl ON a.id_client = cl.id
          LEFT JOIN LATERAL (
            SELECT sa.id_type_statut, tsa.nom_statut AS statut
            FROM Statut_Abonnement sa
            LEFT JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
            WHERE sa.id_abonnement = a.reference
            ORDER BY sa.id DESC LIMIT 1
          ) st ON true
          WHERE 
            -- Échéance atteinte (aujourd'hui ou passée)
            (a.date_echeance <= CURRENT_TIMESTAMP)
            -- Dernier statut actif
            AND LOWER(COALESCE(st.statut, 'actif')) = 'actif'
            -- AUCUN contrat renouvelé n'a déjà pris la suite
            AND NOT EXISTS (
              SELECT 1 FROM Abonnement child 
              WHERE child.id_abonnement_precedent = a.reference
            )
        `;

    const { rows: contratsEchus } = await db.query(query);
    if (contratsEchus.length === 0) {
      console.log('[CRON] Aucun contrat échu à traiter aujourd’hui.');
      return;
    }
    console.log(`[CRON] ${contratsEchus.length} contrat(s) échu(s) détecté(s).`);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    for (const abo of contratsEchus) {
      const ref = abo.reference;
      const isTacite = abo.reconduction_tacite === true || abo.reconduction_tacite === 'true' || abo.reconduction_tacite === 1;

      // Cas 1 : Contrat sous clause de reconduction tacite -> RENOUVELLEMENT AUTOMATIQUE
      if (isTacite) {
        try {
          await renouvelerContratTacitement(abo);
        } catch (e) {
          console.error(`[CRON] Échec renouvellement tacite pour ${ref} :`, e.message);
        }
        continue;
      }

      // Cas 2 : Contrat standard sans reconduction tacite -> EXPIRATION
      // A. Clôturer l'ancien statut dans Statut_Abonnement
      await db.query(`
              UPDATE Statut_Abonnement 
              SET date_fin = CURRENT_TIMESTAMP 
              WHERE id_abonnement = $1 AND (date_fin IS NULL OR date_fin > CURRENT_TIMESTAMP)
            `, [ref]);

      // B. Insérer la nouvelle ligne avec le statut "expiré"
      await db.query(`
              INSERT INTO Statut_Abonnement (id_abonnement, id_type_statut, date_debut, date_fin, commentaire)
              VALUES ($1, $2, CURRENT_TIMESTAMP, NULL, $3)
            `, [
        ref,
        idStatutExpire,
        `[Automatisme CRON du ${dateStr}] Échéance contractuelle atteinte sans renouvellement.`
      ]);

      // C. Libérer automatiquement les supports associés vers l'état 'disponible'
      await AbonnementModel.cascadeStatutToSupports(ref, 'expiré', abo.id_commercial);

      // D. Historique dans Action_Commerciale
      await ActionCommercialeModel.create({
        id_abonnement: ref,
        id_client: abo.id_client,
        id_utilisateur: abo.id_commercial || 1,
        type_action: 'Expiration Contrat',
        description: `Contrat arrivé à terme le ${new Date(abo.date_echeance).toLocaleDateString('fr-FR')} sans renouvellement. Les supports associés ont été libérés.`,
        statut_envoi_email: 'N/A'
      });

      // E. Créer une notification dans le journal d'audit
      await JournalNotificationModel.logAction({
        id_utilisateur: abo.id_commercial || null,
        categorie_action: 'STATUT',
        entite_concernee: 'ABONNEMENT',
        reference_entite: ref,
        valeur_apres: { statut: 'expiré' },
        message_notification: `Le contrat ${ref} est arrivé à échéance sans renouvellement. Les supports associés sont redevenus disponibles.`
      });
      console.log(`[CRON] Contrat ${ref} marqué comme expiré, supports libérés.`);
    }
  } catch (error) {
    console.error('[CRON] Erreur lors du traitement des contrats échus :', error);
  }
}

/**
 * 3. Envoi automatique des courriels de prévention d'échéance aux clients (J-30 ou jours restants)
 *    Conforme au cahier des charges (CDC Art. 7.4 & 7.5) :
 *    - Paramètres dynamiques : 'delai_alerte_j_moins' et 'mail_sender' (ou 'email_expediteur_defaut')
 *    - Gère les pannes / jours manqués : si le serveur n'a pas tourné exactement à J-30,
 *      il envoie le courriel avec le nombre exact de jours restants (ex: 25 jours)
 *    - Récupère le contact email du client (table Contact avec valeur LIKE '%@%', priorisant est_principal = TRUE)
 *    - Vérifie dans Journal_Notification pour éviter les envois en double
 *    - Historise dans Action_Commerciale et Journal_Notification
 */
async function envoieMailAutomatique() {
  try {
    console.log('[CRON] Vérification et envoi des courriels automatiques de prévention d’échéance...');

    // 1. Récupération des paramètres
    // * Délai en jours (ex: 30)
    const resNbj = await db.query(
      `SELECT valeur FROM Parametrage WHERE LOWER(nom_parametre) = 'delai_alerte_j_moins' LIMIT 1`
    );
    const nbJoursSeuil = parseInt(resNbj.rows[0]?.valeur?.trim(), 10) || 30;

    // * Expéditeur email par défaut
    const resMail = await db.query(
      `SELECT valeur FROM Parametrage 
       WHERE LOWER(nom_parametre) IN ('mail_sender', 'email_expediteur_defaut') 
       ORDER BY CASE WHEN LOWER(nom_parametre) = 'mail_sender' THEN 1 ELSE 2 END 
       LIMIT 1`
    );
    const senderMail = resMail.rows[0]?.valeur?.trim() || 'commercial@aeropub.mg';

    // * Mot de passe email expéditeur (depuis .env EMAIL_PASS ou table Parametrage 'mail_password')
    const resPass = await db.query(
      `SELECT valeur FROM Parametrage WHERE LOWER(nom_parametre) IN ('mail_password', 'email_pass', 'mot_de_passe_email') LIMIT 1`
    );
    const emailPassword = process.env.EMAIL_PASS || process.env.SMTP_PASS || resPass.rows[0]?.valeur?.trim();

    // Configuration du transporteur Nodemailer (Gmail SMTP)
    let transporter = null;
    if (emailPassword) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: senderMail,
          pass: emailPassword.replace(/\s+/g, '')
        }
      });
    }

    // 2. Sélection des contrats actifs sans renouvellement arrivant à échéance
    const query = `
      SELECT 
        a.reference, 
        a.id_client,
        a.id_commercial,
        a.date_echeance,
        a.reconduction_tacite,
        a.preavis_jours,
        cl.raison_sociale AS nom_client,
        u.nom AS nom_commercial,
        u.email AS email_commercial,
        (
          SELECT STRING_AGG(reference_support, ', ') 
          FROM Abonnement_Support 
          WHERE id_abonnement = a.reference
        ) AS supports
      FROM Abonnement a
      LEFT JOIN Client cl ON a.id_client = cl.id
      LEFT JOIN Utilisateur u ON a.id_commercial = u.id
      LEFT JOIN LATERAL (
        SELECT sa.id_type_statut, tsa.nom_statut AS statut
        FROM Statut_Abonnement sa
        LEFT JOIN Type_Statut_Abonnement tsa ON sa.id_type_statut = tsa.id
        WHERE sa.id_abonnement = a.reference
        ORDER BY sa.id DESC LIMIT 1
      ) st ON true
      WHERE 
        -- Contrat encore en cours (date future)
        (a.date_echeance > CURRENT_TIMESTAMP)
        -- Dernier statut actif
        AND LOWER(COALESCE(st.statut, 'actif')) = 'actif'
        -- Aucun renouvellement enregistré
        AND NOT EXISTS (
          SELECT 1 FROM Abonnement child 
          WHERE child.id_abonnement_precedent = a.reference
        )
    `;

    const { rows: contratsActifs } = await db.query(query);
    const now = new Date();

    for (const abo of contratsActifs) {
      const dateTerme = new Date(abo.date_echeance);
      // Calcul du nombre de jours restants jusqu'à l'échéance
      const diffJours = Math.ceil((dateTerme.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Si le contrat est déjà expiré ou aujourd'hui même (géré par verifierEtExpirerAbonnements)
      if (diffJours <= 0) continue;

      const isTacite = abo.reconduction_tacite === true || abo.reconduction_tacite === 'true' || abo.reconduction_tacite === 1;

      // Cas 1 : Contrat sous clause de reconduction tacite -> Préavis de résiliation / reconduction
      if (isTacite) {
        const preavisJours = parseInt(abo.preavis_jours, 10) || 30;
        const dateLimitePreavis = new Date(dateTerme.getTime() - preavisJours * 24 * 3600 * 1000);
        const diffJoursPreavis = Math.ceil((dateLimitePreavis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Déclencher le préavis si le contrat approche de sa date limite de notification (fenêtre de 30 jours avant la date limite)
        // OU s'il y a eu une indisponibilité / panne serveur pendant la période d'envoi et qu'aucun mail n'a encore été envoyé (tant que l'échéance n'est pas franchie)
        if (diffJoursPreavis <= 30 && diffJours > 0) {
          const checkPreavis = await db.query(`
            SELECT id FROM Journal_Notification
            WHERE reference_entite = $1
              AND categorie_action = 'PREAVIS_RECONDUCTION'
            LIMIT 1
          `, [abo.reference]);

          if (checkPreavis.rows.length === 0) {
            try {
              const infoRattrapage = diffJoursPreavis < 0
                ? ` [Rattrapage serveur : préavis dépassé de ${Math.abs(diffJoursPreavis)}j, reste ${diffJours}j avant échéance]`
                : ` [reste ${diffJoursPreavis}j avant préavis, ${diffJours}j avant échéance]`;
              console.log(`[CRON - MAIL] Envoi automatique du préavis de reconduction pour le contrat ${abo.reference}${infoRattrapage}...`);
              await ActionCommercialeService.envoyerPreavisReconduction(abo.reference, abo.id_commercial || 1);
            } catch (preavisErr) {
              console.error(`[CRON - MAIL] Échec de l'envoi du préavis pour ${abo.reference} :`, preavisErr.message);
            }
          }
        }
        // Pour les contrats tacites, ne pas envoyer l'email de relance standard
        continue;
      }

      // Cas 2 : Contrats standards sans reconduction tacite
      // Si l'échéance dépasse le seuil de prévention (ex: > 30 jours)
      if (diffJours > nbJoursSeuil) continue;

      // 3. Vérification anti-doublon dans Journal_Notification
      const checkMail = await db.query(`
        SELECT id FROM Journal_Notification
        WHERE reference_entite = $1
          AND categorie_action = 'EMAIL_ECHEANCE'
        LIMIT 1
      `, [abo.reference]);

      if (checkMail.rows.length > 0) {
        // Le courriel a déjà été expédié pour cette échéance de ce contrat
        continue;
      }

      // 4. Récupération du contact email du client
      // Privilégie un contact avec nom_contact = 'email' (ou contenant email/mail), avec adresse email valide
      const contactRes = await db.query(`
        SELECT nom_contact, valeur, est_principal
        FROM Contact
        WHERE id_client = $1 
          AND TRIM(valeur) LIKE '%@%'
        ORDER BY 
          CASE 
            WHEN LOWER(TRIM(nom_contact)) = 'email' AND est_principal = TRUE THEN 1
            WHEN LOWER(TRIM(nom_contact)) = 'email' THEN 2
            WHEN (LOWER(nom_contact) LIKE '%email%' OR LOWER(nom_contact) LIKE '%mail%') AND est_principal = TRUE THEN 3
            WHEN LOWER(nom_contact) LIKE '%email%' OR LOWER(nom_contact) LIKE '%mail%' THEN 4
            WHEN est_principal = TRUE THEN 5
            ELSE 6
          END ASC, 
          id ASC
        LIMIT 1
      `, [abo.id_client]);

      if (contactRes.rows.length === 0) {
        console.warn(`[CRON - MAIL] Aucun contact email valide trouvé pour le client "${abo.nom_client || abo.id_client}" (Contrat ${abo.reference}).`);
        continue;
      }

      const contact = contactRes.rows[0];
      const destEmail = contact.valeur.trim();
      const contactNomTrim = (contact.nom_contact || '').replace(/^\[.*?\]\s*/, '').trim();
      const isGenericNom = !contactNomTrim ||
        ['email', 'mail', 'contact', 'telephone', 'autre'].includes(contactNomTrim.toLowerCase());
      const destNom = !isGenericNom ? contactNomTrim : (abo.nom_client || 'Madame, Monsieur');
      const dateFr = dateTerme.toLocaleDateString('fr-FR');
      const supportsStr = abo.supports || 'publicitaire(s)';
      const interlocuteurStr = abo.nom_commercial
        ? `${abo.nom_commercial}${abo.email_commercial ? ` (${abo.email_commercial})` : ''}`
        : senderMail;

      // 5. Modèle du courriel depuis la table Modele_Courriel (avec repli par défaut CDC Art. 7.4 & 7.5)
      let objetMail = `Échéance prochaine de votre contrat publicitaire AEROPUB - ${abo.reference}`;
      let corpsMail = `Bonjour ${destNom},

Nous vous informons que votre contrat n° ${abo.reference}, relatif au(x) support(s) ${supportsStr}, arrivera à échéance dans ${diffJours} jour(s), le ${dateFr}.

Votre interlocuteur AEROPUB (${interlocuteurStr}) prendra contact avec vous afin d'étudier son renouvellement.

Bien cordialement,
L'équipe commerciale AEROPUB`;

      try {
        const resModele = await db.query(
          "SELECT sujet, corps FROM Modele_Courriel WHERE code = 'RELANCE_ECHEANCE' LIMIT 1"
        );
        if (resModele.rows.length > 0 && resModele.rows[0].corps) {
          const rawSujet = resModele.rows[0].sujet || objetMail;
          const rawCorps = resModele.rows[0].corps;

          const replaceVars = (text) => text
            .replace(/\{destNom\}/g, destNom)
            .replace(/\{reference\}/g, abo.reference)
            .replace(/\{supports\}/g, supportsStr)
            .replace(/\{diffJours\}/g, `${diffJours}`)
            .replace(/\{dateFr\}/g, dateFr)
            .replace(/\{interlocuteur\}/g, interlocuteurStr);

          objetMail = replaceVars(rawSujet);
          corpsMail = replaceVars(rawCorps);
        }
      } catch (mErr) {
        console.warn('[CRON - MAIL] Erreur chargement Modele_Courriel :', mErr.message);
      }

      console.log(`[CRON - MAIL] Envoi courriel de prévention pour le contrat ${abo.reference} à ${destNom} <${destEmail}> (reste ${diffJours} jour(s)).`);

      // 6. Expédition réelle de l'email via Nodemailer (si mot de passe configuré)
      let statutEnvoi = 'Envoyé';
      if (transporter) {
        try {
          await transporter.sendMail({
            from: `"AEROPUB" <${senderMail}>`,
            to: destEmail,
            subject: objetMail,
            text: corpsMail
          });
          console.log(`[CRON - MAIL] ✅ Email réel transmis avec succès par SMTP à ${destEmail} !`);
        } catch (sendErr) {
          statutEnvoi = 'Erreur envoi';
          console.error(`[CRON - MAIL] ❌ Échec de la transmission SMTP à ${destEmail} :`, sendErr.message);
        }
      } else {
        console.warn(`[CRON - MAIL] ⚠️ Aucun mot de passe SMTP configuré (EMAIL_PASS dans .env ou 'mail_password' dans Parametrage). Le mail a seulement été simulé et tracé en base.`);
      }

      // 7. Enregistrement dans Action_Commerciale (suivi commercial & alertes)
      await ActionCommercialeModel.create({
        id_abonnement: abo.reference,
        id_client: abo.id_client,
        id_utilisateur: abo.id_commercial || 1,
        type_action: 'Email Échéance',
        description: `Courriel automatique de prévention J-${diffJours} envoyé à ${destNom} (${destEmail}) pour l'échéance du ${dateFr}. Statut: ${statutEnvoi}.`,
        statut_envoi_email: statutEnvoi
      });

      // 8. Enregistrement dans Journal_Notification (audit + anti-doublon)
      await JournalNotificationModel.logAction({
        id_utilisateur: abo.id_commercial || null,
        categorie_action: 'EMAIL_ECHEANCE',
        entite_concernee: 'ABONNEMENT',
        reference_entite: abo.reference,
        valeur_apres: {
          type: 'prevention_echeance',
          destinataire_email: destEmail,
          destinataire_nom: destNom,
          diffJours: diffJours,
          date_echeance: abo.date_echeance,
          expediteur: senderMail,
          objet: objetMail,
          statut: statutEnvoi
        },
        message_notification: `Email de prévention d'échéance envoyé à ${destNom} (${destEmail}) pour le contrat ${abo.reference} (échéance dans ${diffJours} jour(s) le ${dateFr}) - ${statutEnvoi}.`
      });

      console.log(`[CRON - MAIL] Email tracé avec succès dans Action_Commerciale et Journal_Notification pour ${abo.reference}.`);
    }
  } catch (error) {
    console.error('[CRON - MAIL] Erreur lors de l’envoi automatique des courriels d’échéance :', error);
  }
}

/**
 * Initialiser la planification node-cron dynamique selon Heure_serveur
 */

async function getHeureServeurParametree() {
  try {
    const resultatParametrage = await db.query(
      `SELECT valeur FROM Parametrage WHERE LOWER(nom_parametre) = 'heure_serveur' LIMIT 1`
    );
    return resultatParametrage.rows[0]?.valeur?.trim() || '00:00';
  } catch (error) {
    console.error('[CRON] Erreur lecture Heure_serveur dans Parametrage:', error);
    return '00:00';
  }
}

let tacheCronAbonnement = null;
let derniereHeureParametree = null;

function replanifierTacheQuotidienne(heureStr) {
  if (tacheCronAbonnement) {
    tacheCronAbonnement.stop();
  }

  // Découpage de l'heure (ex: '14:00' -> heure: 14, minute: 0)
  const [h, m] = (heureStr || '00:00').split(':');
  const heure = parseInt(h, 10) || 0;
  const minute = parseInt(m, 10) || 0;
  const cronExpression = `${minute} ${heure} * * *`;

  tacheCronAbonnement = cron.schedule(cronExpression, async () => {
    console.log(`[CRON] Déclenchement automatique planifié à ${heureStr} (Heure de Madagascar)...`);
    await verifierAlertesEcheances();
    await envoieMailAutomatique();
    await verifierEtExpirerAbonnements();
  }, {
    scheduled: true,
    timezone: 'Indian/Antananarivo' // Fuseau horaire de Madagascar
  });

  console.log(`⏰ [CRON] Tâche quotidienne programmée à ${heureStr} (${cronExpression}) [Fuseau: Indian/Antananarivo].`);
}

async function initAbonnementCron() {
  console.log('⏰ Tâche CRON de surveillance dynamique initialisée (vérification continue selon Heure_serveur).');

  // 1. Planification immédiate avec l'heure actuellement configurée
  const heureInitiale = await getHeureServeurParametree();
  derniereHeureParametree = heureInitiale;
  replanifierTacheQuotidienne(heureInitiale);

  // 2. Surveillance chaque minute : si l'admin change 'Heure_serveur' en base,
  //    replanifie automatiquement SANS redémarrer le serveur
  cron.schedule('* * * * *', async () => {
    try {
      const heureStr = await getHeureServeurParametree();
      if (heureStr !== derniereHeureParametree) {
        console.log(`[CRON] 🔄 Changement d'heure détecté dans Parametrage : ${derniereHeureParametree} -> ${heureStr}`);
        derniereHeureParametree = heureStr;
        replanifierTacheQuotidienne(heureStr);
      }
    } catch (e) {
      console.error('[CRON] Erreur lors de la vérification dynamique de l\'heure:', e);
    }
  });

  // 3. Rattrapage automatique au démarrage (en cas d'interruption/panne serveur les jours passés)
  setTimeout(async () => {
    try {
      console.log('🔄 [CRON - STARTUP] Démarrage du rattrapage automatique (échéances, alertes et reconductions tacites)...');
      await verifierAlertesEcheances();
      await envoieMailAutomatique();
      await verifierEtExpirerAbonnements();
      console.log('✅ [CRON - STARTUP] Rattrapage automatique achevé.');
    } catch (startErr) {
      console.error('❌ [CRON - STARTUP] Erreur lors du rattrapage automatique initial :', startErr);
    }
  }, 3500);
}

module.exports = {
  initAbonnementCron,
  verifierAlertesEcheances,
  verifierEtExpirerAbonnements,
  envoieMailAutomatique
};
