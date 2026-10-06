const db = require('../config/db');
const nodemailer = require('nodemailer');
const ActionCommercialeModel = require('../models/actionCommercialeModel');
const JournalNotificationModel = require('../models/journalNotificationModel');

class ActionCommercialeService {
  static async getAll() {
    return ActionCommercialeModel.getAll();
  }

  static async getById(id) {
    const item = await ActionCommercialeModel.getById(id);
    if (!item) {
      const error = new Error(`Action commerciale introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    return ActionCommercialeModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    return ActionCommercialeModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return ActionCommercialeModel.delete(id);
  }

  static async envoyerRelanceManuelle(reference, id_utilisateur = 1) {
    if (!reference) {
      const error = new Error('La référence du contrat est requise.');
      error.statusCode = 400;
      throw error;
    }

    // Récupération des identifiants SMTP dans Parametrage / .env
    const resMail = await db.query(
      `SELECT valeur FROM Parametrage 
       WHERE LOWER(nom_parametre) IN ('mail_sender', 'email_expediteur_defaut')
       ORDER BY CASE WHEN LOWER(nom_parametre) = 'mail_sender' THEN 1 ELSE 2 END 
       LIMIT 1`
    );
    const senderMail = resMail.rows[0]?.valeur?.trim() || 'commercial@aeropub.mg';

    const resPass = await db.query(
      `SELECT valeur FROM Parametrage WHERE LOWER(nom_parametre) IN ('mail_password', 'email_pass', 'mot_de_passe_email') LIMIT 1`
    );
    const emailPassword = process.env.EMAIL_PASS || process.env.SMTP_PASS || resPass.rows[0]?.valeur?.trim();

    if (!emailPassword) {
      const error = new Error("Mot de passe email expéditeur non configuré (paramètre 'mail_password' manquant dans Paramétrage).");
      error.statusCode = 500;
      throw error;
    }

    // Récupération du contrat et de ses détails
    const resAbo = await db.query(`
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
      WHERE a.reference = $1
    `, [reference]);

    if (resAbo.rows.length === 0) {
      const error = new Error(`Contrat introuvable avec la référence "${reference}".`);
      error.statusCode = 404;
      throw error;
    }

    const abo = resAbo.rows[0];

    // Récupération du contact email du client (table Contact)
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
      const error = new Error(`Aucun contact email valide trouvé pour le client "${abo.nom_client || 'Client'}". Veuillez renseigner son email dans la fiche client.`);
      error.statusCode = 400;
      throw error;
    }

    const contact = contactRes.rows[0];
    const destEmail = contact.valeur.trim();
    const contactNomTrim = (contact.nom_contact || '').replace(/^\[.*?\]\s*/, '').trim();
    const isGenericNom = !contactNomTrim || 
      ['email', 'mail', 'contact', 'telephone', 'autre'].includes(contactNomTrim.toLowerCase());
    const destNom = !isGenericNom ? contactNomTrim : (abo.nom_client || 'Madame, Monsieur');
    const now = new Date();
    const dateTerme = new Date(abo.date_echeance);
    const diffJours = Math.ceil((dateTerme.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateFr = dateTerme.toLocaleDateString('fr-FR');
    const supportsStr = abo.supports || 'publicitaire(s)';
    const interlocuteurStr = abo.nom_commercial
      ? `${abo.nom_commercial}${abo.email_commercial ? ` (${abo.email_commercial})` : ''}`
      : senderMail;

    // 4. Modèle de courriel dynamique depuis la table Modele_Courriel
    let objetMail = `Échéance prochaine de votre contrat publicitaire AEROPUB - ${abo.reference}`;
    let corpsMail = `Bonjour ${destNom},

Nous vous informons que votre contrat n° ${abo.reference}, relatif au(x) support(s) ${supportsStr}, arrivera à échéance dans ${diffJours > 0 ? `${diffJours} jour(s)` : 'très peu de temps'}, le ${dateFr}.

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
          .replace(/\{diffJours\}/g, diffJours > 0 ? `${diffJours}` : '0')
          .replace(/\{dateFr\}/g, dateFr)
          .replace(/\{interlocuteur\}/g, interlocuteurStr);

        objetMail = replaceVars(rawSujet);
        corpsMail = replaceVars(rawCorps);
      }
    } catch (modelErr) {
      console.warn('[MAIL MANUEL] Erreur chargement Modele_Courriel, utilisation du modèle par défaut :', modelErr.message);
    }

    // Expédition par Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderMail,
        pass: emailPassword.replace(/\s+/g, '')
      }
    });

    let statutEnvoi = 'Envoyé';
    try {
      await transporter.sendMail({
        from: `"AEROPUB" <${senderMail}>`,
        to: destEmail,
        subject: objetMail,
        text: corpsMail
      });
    } catch (sendErr) {
      console.error('[MAIL MANUEL] Erreur envoi SMTP :', sendErr);
      const error = new Error(`Échec de la transmission du courriel par SMTP : ${sendErr.message}`);
      error.statusCode = 502;
      throw error;
    }

    // historique 
    const action = await ActionCommercialeModel.create({
      id_abonnement: abo.reference,
      id_client: abo.id_client,
      id_utilisateur: id_utilisateur || abo.id_commercial || 1,
      type_action: 'Relance',
      description: `Courriel de relance manuelle envoyé à ${destNom} (${destEmail}) pour le contrat ${abo.reference}. Échéance : ${dateFr}.`,
      statut_envoi_email: statutEnvoi
    });

    // Audit
    await JournalNotificationModel.logAction({
      id_utilisateur: id_utilisateur || abo.id_commercial || null,
      categorie_action: 'EMAIL_MANUEL_RELANCE',
      entite_concernee: 'ABONNEMENT',
      reference_entite: abo.reference,
      valeur_apres: {
        type: 'relance_manuelle',
        destinataire_email: destEmail,
        destinataire_nom: destNom,
        diffJours: diffJours,
        date_echeance: abo.date_echeance,
        expediteur: senderMail,
        statut: statutEnvoi
      },
      message_notification: `Email de relance manuelle envoyé à ${destNom} (${destEmail}) pour le contrat ${abo.reference}.`
    });

    return {
      success: true,
      message: `Courriel de relance envoyé avec succès à ${destEmail} !`,
      action,
      destEmail
    };
  }

}

module.exports = ActionCommercialeService;
