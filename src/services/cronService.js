const cron = require('node-cron');
const db = require('../config/db');
const AbonnementModel = require('../models/abonnementModel');
const JournalNotificationModel = require('../models/journalNotificationModel');

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
 * Initialiser la planification node-cron
 */

async function getHeureServeurParametree() {
  try {
    const res = await db.query(
      `
        SELECT valeur FROM Parametrage WHERE LOWER(nom_parametre) = 
        'heure_serveur' LIMIT 1
      `
    );
    return res.rows[0]?.valeur?.trim() || '00:00';
  } catch (error) {
    console.error('[CRON] Erreur lecture Heure_serveur dans Parametrage:', error);
    return '00:00';
  }
}

let tacheCronAbonnement = null;
let derniereExecutionCle = null;

async function initAbonnementCron() {
  console.log('⏰ Tâche CRON de surveillance dynamique initialisée (vérification continue selon Heure_serveur).');

  // tourne chaque minute
  cron.schedule('* * * * *', async () => {
    // Avoir l heure dans la base dans la table parametre
    const heureStr = await getHeureServeurParametree();

    // decoupage de l'heure (ex: '14:00' en heure:14 et minute:0)
    const [h, m] = heureStr.split(':');
    const heure = parseInt(h, 10) || 0;
    const minute = parseInt(m, 10) || 0;

    // Expression cron : minute heure * * * (ex: '0 14 * * *')
    const cronExpression = `${minute} ${heure} * * *`;
    if (tacheCronAbonnement) {
      tacheCronAbonnement.stop();
    }

    // Planifier avec le fuseau horaire de madagascar (UTC+3)
    tacheCronAbonnement = cron.schedule(cronExpression, async () => {
      console.log(`[CRON] Déclenchement automatique planifié à ${heureStr} (Heure de Madagascar)...`);
      await verifierAlertesEcheances();
      await verifierEtExpirerAbonnements();
    }, {
      scheduled: true,
      timezone: 'Indian/Antananarivo' // Heure de Madagascar
    });
  });
}

module.exports = {
  initAbonnementCron,
  verifierAlertesEcheances,
  verifierEtExpirerAbonnements
};
