const cron = require('node-cron');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const AbonnementModel = require('../models/abonnementModel');
const JournalNotificationModel = require('../models/journalNotificationModel');
const ActionCommercialeModel = require('../models/actionCommercialeModel');

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

        await JournalNotificationModel.logAction({
          id_utilisateur: abo.id_commercial || null,
          categorie_action: 'ECHEANCE',
          entite_concernee: 'ABONNEMENT',
          reference_entite: abo.reference,
          valeur_apres: {
            palier: palier,
            diffJours: diffJours,
            date_echeance: abo.date_terme
          },
          message_notification: `[Alerte J-${palier}] Le contrat ${abo.reference}${clientInfo} arrive à échéance dans ${diffJours} jour(s) (le ${dateFr}). Aucun renouvellement enregistré.`
        });

        console.log(`[CRON] Alerte J-${palier} envoyée pour le contrat ${abo.reference} (reste ${diffJours} jour(s)).`);
      }
    }
  } catch (error) {
    console.error('[CRON] Erreur lors de la vérification des alertes d’échéance :', error);
  }
}

/**
 * 2. Vérifie les contrats arrivés à échéance et les passe en expiré + libère les supports
 */
async function verifierEtExpirerAbonnements() {
  try {
    console.log('[CRON] Vérification des contrats arrivés à échéance ...');

    // 1. Recupération de l'id du statut "expiré"
    const statutExpRes = await db.query(
      "SELECT id FROM Type_Statut_Abonnement WHERE LOWER(nom_statut) = 'expiré' OR " +
      "LOWER(nom_statut) = 'expire' LIMIT 1"
    );
    const idStatutExpire = statutExpRes.rows[0]?.id || 6;

    // 2. Sélectionner les abonnements échus sans renouvellement
    const query = `
          SELECT 
            a.reference, 
            a.id_commercial,
            a.date_echeance,
            st.statut AS dernier_statut
          FROM Abonnement a
          -- Dernier statut connu de l'abonnement
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
            -- Dernier statut actif (ou non déjà clôturé)
            AND LOWER(COALESCE(st.statut, 'actif')) = 'actif'
            -- AUCUN contrat renouvelé n'a pris la suite
            AND NOT EXISTS (
              SELECT 1 FROM Abonnement child 
              WHERE child.id_abonnement_precedent = a.reference
            )
        `;

    const { rows: contratsAExpirer } = await db.query(query);
    if (contratsAExpirer.length === 0) {
      console.log('[CRON] Aucun contrat à expirer aujourd’hui.');
      return;
    }
    console.log(`[CRON] ${contratsAExpirer.length} contrat(s) à passer à l'état expiré.`);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    for (const abo of contratsAExpirer) {
      const ref = abo.reference;
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
      // D. Créer une notification dans le journal
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
    console.error('[CRON] Erreur lors de l’expiration automatique des contrats :', error);
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

      // 4. Récupération du contact email du client (privilégie le contact principal avec email valide)
      const contactRes = await db.query(`
        SELECT nom_contact, valeur, est_principal
        FROM Contact
        WHERE id_client = $1 
          AND valeur LIKE '%@%'
        ORDER BY est_principal DESC, id ASC
        LIMIT 1
      `, [abo.id_client]);

      if (contactRes.rows.length === 0) {
        console.warn(`[CRON - MAIL] Aucun contact email valide trouvé pour le client "${abo.nom_client || abo.id_client}" (Contrat ${abo.reference}).`);
        continue;
      }

      const contact = contactRes.rows[0];
      const destEmail = contact.valeur.trim();
      const destNom = contact.nom_contact?.trim() || abo.nom_client || 'Madame, Monsieur';
      const dateFr = dateTerme.toLocaleDateString('fr-FR');
      const supportsStr = abo.supports || 'publicitaire(s)';
      const interlocuteurStr = abo.nom_commercial
        ? `${abo.nom_commercial}${abo.email_commercial ? ` (${abo.email_commercial})` : ''}`
        : senderMail;

      // 5. Modèle du courriel selon le Cahier des Charges (CDC Art. 7.4 & 7.5)
      //    Mentionne le nombre exact de jours restants (ex: 25 jours en cas de panne serveur à J-30)
      const objetMail = `Échéance prochaine de votre contrat publicitaire AEROPUB - ${abo.reference}`;
      const corpsMail = `Bonjour ${destNom},

Nous vous informons que votre contrat n° ${abo.reference}, relatif au(x) support(s) ${supportsStr}, arrivera à échéance dans ${diffJours} jour(s), le ${dateFr}.

Votre interlocuteur AEROPUB (${interlocuteurStr}) prendra contact avec vous afin d'étudier son renouvellement.

Bien cordialement,
L'équipe commerciale AEROPUB`;

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
    const res = await db.query(
      `SELECT valeur FROM Parametrage WHERE LOWER(nom_parametre) = 'heure_serveur' LIMIT 1`
    );
    return res.rows[0]?.valeur?.trim() || '00:00';
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
}

module.exports = {
  initAbonnementCron,
  verifierAlertesEcheances,
  verifierEtExpirerAbonnements,
  envoieMailAutomatique
};
