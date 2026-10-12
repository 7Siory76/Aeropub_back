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

  static async envoyerPreavisReconduction(reference, id_utilisateur = 1) {
    if (!reference) {
      const error = new Error('La référence du contrat est requise.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Récupération des identifiants SMTP dans Parametrage / .env
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

    // 2. Récupération du contrat et de ses détails
    const resAbo = await db.query(`
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
        ) AS supports,
        COALESCE(st.statut, 'actif') AS statut,
        EXISTS (
          SELECT 1 FROM Abonnement child 
          WHERE child.id_abonnement_precedent = a.reference
        ) AS a_renouvellement
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
      WHERE a.reference = $1
    `, [reference]);

    if (resAbo.rows.length === 0) {
      const error = new Error(`Contrat introuvable avec la référence "${reference}".`);
      error.statusCode = 404;
      throw error;
    }

    const abo = resAbo.rows[0];

    // Vérification : contrat ACTIF uniquement
    const statutClean = String(abo.statut || '').trim().toLowerCase();
    if (statutClean !== 'actif') {
      const error = new Error(`Le contrat "${reference}" n'est pas actif (statut actuel : "${abo.statut}"). Seuls les contrats actifs peuvent faire l'objet d'un préavis de résiliation/reconduction.`);
      error.statusCode = 400;
      throw error;
    }

    // Vérification : AUCUN renouvellement existant
    if (abo.a_renouvellement) {
      const error = new Error(`Le contrat "${reference}" a déjà fait l'objet d'un renouvellement. Aucun préavis de résiliation n'est nécessaire.`);
      error.statusCode = 400;
      throw error;
    }

    // Vérification : clause de reconduction tacite activée
    const isTacite = abo.reconduction_tacite === true || abo.reconduction_tacite === 'true' || abo.reconduction_tacite === 1;
    if (!isTacite) {
      const error = new Error(`Le contrat "${reference}" n'est pas soumis à la clause de reconduction tacite. Utilisez la relance d'échéance standard.`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Récupération du contact email du client (table Contact)
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
    const preavisJours = parseInt(abo.preavis_jours, 10) || 30;
    const dateLimitePreavis = new Date(dateTerme.getTime() - preavisJours * 24 * 3600 * 1000);
    const diffJoursPreavis = Math.ceil((dateLimitePreavis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const diffJoursEcheance = Math.ceil((dateTerme.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateFr = dateTerme.toLocaleDateString('fr-FR');
    const dateLimitePreavisFr = dateLimitePreavis.toLocaleDateString('fr-FR');
    const supportsStr = abo.supports || 'publicitaire(s)';
    const interlocuteurStr = abo.nom_commercial
      ? `${abo.nom_commercial}${abo.email_commercial ? ` (${abo.email_commercial})` : ''}`
      : senderMail;

    let texteDelai = '';
    if (diffJoursPreavis > 0) {
      texteDelai = `${diffJoursPreavis} jour(s) pour nous notifier votre décision (date limite : ${dateLimitePreavisFr}), et ${diffJoursEcheance} jour(s) avant l'échéance (${dateFr})`;
    } else if (diffJoursPreavis === 0) {
      texteDelai = `le délai de préavis expire aujourd'hui même (${dateLimitePreavisFr}), et il reste ${diffJoursEcheance} jour(s) avant l'échéance (${dateFr})`;
    } else {
      texteDelai = `${diffJoursEcheance} jour(s) restant(s) avant l'échéance définitive et le renouvellement automatique (${dateFr}) [Préavis initial de ${preavisJours}j échu le ${dateLimitePreavisFr}]`;
    }

    // 4. Modèle de courriel dynamique depuis Modele_Courriel ('PREAVIS_RECONDUCTION')
    let objetMail = `Préavis de reconduction tacite - Contrat AEROPUB ${abo.reference}`;
    let corpsMail = `Bonjour ${destNom},

Nous vous informons que votre contrat publicitaire n° ${abo.reference}, portant sur le(s) support(s) ${supportsStr}, arrivera à son terme le ${dateFr}.

Conformément à la clause de reconduction tacite et au préavis contractuel de ${preavisJours} jours (date limite de notification : ${dateLimitePreavisFr}), ce contrat sera automatiquement reconduit pour une durée identique, sauf dénonciation écrite expresse de votre part avant cette date limite.

Délai restant : ${texteDelai}.

- Si vous souhaitez poursuivre votre collaboration et renouveler ce contrat, vous n'avez aucune démarche à entreprendre.
- Si vous souhaitez résilier votre contrat à son terme sans reconduction, nous vous remercions de bien vouloir nous en notifier par retour de ce courriel avant le ${dateLimitePreavisFr}.

Votre interlocuteur commercial AEROPUB (${interlocuteurStr}) se tient à votre entière disposition pour tout renseignement.

Bien cordialement,
L'équipe commerciale AEROPUB`;

    try {
      const resModele = await db.query(
        "SELECT sujet, corps FROM Modele_Courriel WHERE code = 'PREAVIS_RECONDUCTION' LIMIT 1"
      );
      if (resModele.rows.length > 0 && resModele.rows[0].corps) {
        const rawSujet = resModele.rows[0].sujet || objetMail;
        const rawCorps = resModele.rows[0].corps;

        const replaceVars = (text) => text
          .replace(/\{destNom\}/g, destNom)
          .replace(/\{reference\}/g, abo.reference)
          .replace(/\{supports\}/g, supportsStr)
          .replace(/\{dateFr\}/g, dateFr)
          .replace(/\{preavisJours\}/g, `${preavisJours}`)
          .replace(/\{dateLimitePreavisFr\}/g, dateLimitePreavisFr)
          .replace(/\{diffJoursPreavis\}/g, diffJoursPreavis > 0 ? `${diffJoursPreavis}` : '0')
          .replace(/\{diffJoursEcheance\}/g, diffJoursEcheance > 0 ? `${diffJoursEcheance}` : '0')
          .replace(/\{diffJours\}/g, diffJoursEcheance > 0 ? `${diffJoursEcheance}` : '0')
          .replace(/\{nbJoursRestants\}/g, texteDelai)
          .replace(/\{interlocuteur\}/g, interlocuteurStr);

        objetMail = replaceVars(rawSujet);
        corpsMail = replaceVars(rawCorps);
      } else {
        // Enregistrer le modèle par défaut dans Modele_Courriel s'il n'existe pas encore
        await db.query(`
          INSERT INTO Modele_Courriel (code, nom, sujet, corps)
          VALUES ('PREAVIS_RECONDUCTION', 'Préavis de reconduction tacite', $1, $2)
          ON CONFLICT (code) DO NOTHING
        `, [objetMail, corpsMail]);
      }
    } catch (modelErr) {
      console.warn('[PREAVIS RECONDUCTION] Erreur chargement Modele_Courriel :', modelErr.message);
    }

    // 5. Expédition réelle de l'email via Nodemailer
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
      console.error('[PREAVIS RECONDUCTION] Erreur envoi SMTP :', sendErr);
      const error = new Error(`Échec de la transmission du courriel par SMTP : ${sendErr.message}`);
      error.statusCode = 502;
      throw error;
    }

    // 6. Enregistrement dans Action_Commerciale
    const isRattrapage = diffJoursPreavis < 0;
    const prefixRattrapage = isRattrapage ? '[Rattrapage] ' : '';
    const descAction = `${prefixRattrapage}Courriel de préavis de reconduction tacite envoyé à ${destNom} (${destEmail}) pour le contrat ${abo.reference}. ${texteDelai}. Statut: ${statutEnvoi}.`;

    const action = await ActionCommercialeModel.create({
      id_abonnement: abo.reference,
      id_client: abo.id_client,
      id_utilisateur: id_utilisateur || abo.id_commercial || 1,
      type_action: 'Préavis Reconduction',
      description: descAction,
      statut_envoi_email: statutEnvoi
    });

    // 7. Audit & Historique dans Journal_Notification
    await JournalNotificationModel.logAction({
      id_utilisateur: id_utilisateur || abo.id_commercial || null,
      categorie_action: 'PREAVIS_RECONDUCTION',
      entite_concernee: 'ABONNEMENT',
      reference_entite: abo.reference,
      valeur_apres: {
        type: 'preavis_reconduction',
        destinataire_email: destEmail,
        destinataire_nom: destNom,
        date_echeance: abo.date_echeance,
        date_limite_preavis: dateLimitePreavis,
        preavis_jours: preavisJours,
        diffJoursPreavis: diffJoursPreavis,
        diffJoursEcheance: diffJoursEcheance,
        rattrapage: isRattrapage,
        delai_info: texteDelai,
        expediteur: senderMail,
        statut: statutEnvoi
      },
      message_notification: `${prefixRattrapage}Email de préavis de reconduction tacite envoyé à ${destNom} (${destEmail}) pour le contrat ${abo.reference} (${texteDelai}).`
    });

    return {
      success: true,
      message: `Courriel de préavis de reconduction envoyé avec succès à ${destEmail} !`,
      action,
      destEmail,
      dateLimitePreavisFr
    };
  }

}

module.exports = ActionCommercialeService;
