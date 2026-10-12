const db = require('../config/db');

const DEFAULT_TEMPLATES = {
  RELANCE_ECHEANCE: {
    nom: "Relance préventive d'échéance",
    sujet: "Échéance prochaine de votre contrat publicitaire AEROPUB - {reference}",
    corps: `Bonjour {destNom},

Nous vous informons que votre contrat n° {reference}, relatif au(x) support(s) {supports}, arrivera à échéance dans {diffJours} jour(s), le {dateFr}.

Votre interlocuteur AEROPUB ({interlocuteur}) prendra contact avec vous afin d'étudier son renouvellement.

Bien cordialement,
L'équipe commerciale AEROPUB`
  },
  PREAVIS_RECONDUCTION: {
    nom: "Préavis de reconduction tacite",
    sujet: "Préavis de reconduction tacite - Contrat AEROPUB {reference}",
    corps: `Bonjour {destNom},

Nous vous informons que votre contrat publicitaire n° {reference}, relatif au(x) support(s) {supports}, arrivera à son terme le {dateFr}.

Conformément à la clause de reconduction tacite et au préavis contractuel de {preavisJours} jours (date limite de résiliation : {dateLimitePreavisFr}), ce contrat sera automatiquement reconduit pour une durée identique, sauf dénonciation écrite expresse de votre part avant cette date limite.

Délai restant : {nbJoursRestants}.

- Si vous souhaitez poursuivre votre collaboration et renouveler ce contrat, vous n'avez aucune démarche à entreprendre.
- Si vous souhaitez résilier votre contrat à son terme sans reconduction, nous vous remercions de bien vouloir nous en notifier par retour de ce courriel avant le {dateLimitePreavisFr}.

Votre interlocuteur commercial AEROPUB ({interlocuteur}) se tient à votre entière disposition pour tout renseignement.

Bien cordialement,
L'équipe commerciale AEROPUB`
  }
};

class ModeleCourrielModel {
  static async seedDefaults() {
    for (const [code, tpl] of Object.entries(DEFAULT_TEMPLATES)) {
      await db.query(`
        INSERT INTO Modele_Courriel (code, nom, sujet, corps)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO NOTHING
      `, [code, tpl.nom, tpl.sujet, tpl.corps]);
    }
  }

  static async getAll() {
    await this.seedDefaults();
    const { rows } = await db.query('SELECT * FROM Modele_Courriel ORDER BY id ASC');
    return rows;
  }

  static async getByCode(code) {
    let { rows } = await db.query('SELECT * FROM Modele_Courriel WHERE code = $1', [code]);
    if (rows.length === 0 && DEFAULT_TEMPLATES[code]) {
      const tpl = DEFAULT_TEMPLATES[code];
      const insertRes = await db.query(`
        INSERT INTO Modele_Courriel (code, nom, sujet, corps)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO NOTHING
        RETURNING *
      `, [code, tpl.nom, tpl.sujet, tpl.corps]);
      return insertRes.rows[0] || (await db.query('SELECT * FROM Modele_Courriel WHERE code = $1', [code])).rows[0] || null;
    }
    return rows[0] || null;
  }

  static async updateByCode(code, { sujet, corps, nom }) {
    // S'assurer que le modèle existe d'abord
    await this.getByCode(code);
    const { rows } = await db.query(
      `UPDATE Modele_Courriel
       SET sujet = COALESCE($1, sujet),
           corps = COALESCE($2, corps),
           nom = COALESCE($3, nom),
           date_modification = CURRENT_TIMESTAMP
       WHERE code = $4
       RETURNING *`,
      [sujet, corps, nom || null, code]
    );
    return rows[0] || null;
  }
}

module.exports = ModeleCourrielModel;
