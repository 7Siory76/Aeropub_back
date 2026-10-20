const db = require('../config/db');
const JournalNotificationModel = require('./journalNotificationModel');

class TypeSupportModel {
  static async getAll() {
    const { rows } = await db.query('SELECT id, nom, nom AS nom_type FROM Type_Support ORDER BY id ASC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT id, nom, nom AS nom_type FROM Type_Support WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ nom, nom_type }) {
    const finalNom = nom || nom_type;
    const query = 'INSERT INTO Type_Support (nom) VALUES ($1) RETURNING id, nom, nom AS nom_type';
    const { rows } = await db.query(query, [finalNom]);
    const created = rows[0];

    await JournalNotificationModel.logAction({
      categorie_action: 'CREATION',
      entite_concernee: 'TYPE_SUPPORT',
      reference_entite: String(created.id),
      valeur_apres: created,
      message_notification: `Nouveau type de support "${created.nom}" (ID: ${created.id}) créé.`
    });

    return created;
  }

  static async update(id, { nom, nom_type }) {
    const finalNom = nom || nom_type;
    const query = 'UPDATE Type_Support SET nom = $1 WHERE id = $2 RETURNING id, nom, nom AS nom_type';
    const { rows } = await db.query(query, [finalNom, id]);
    const updated = rows[0];

    await JournalNotificationModel.logAction({
      categorie_action: 'MODIFICATION',
      entite_concernee: 'TYPE_SUPPORT',
      reference_entite: String(id),
      valeur_apres: updated,
      message_notification: `Mise à jour du type de support "${updated.nom}" (ID: ${id}).`
    });

    return updated;
  }

  static async delete(id) {
    const current = await this.getById(id);
    const { rows } = await db.query('DELETE FROM Type_Support WHERE id = $1 RETURNING *', [id]);

    await JournalNotificationModel.logAction({
      categorie_action: 'SUPPRESSION',
      entite_concernee: 'TYPE_SUPPORT',
      reference_entite: String(id),
      valeur_apres: current,
      message_notification: `Suppression du type de support "${current?.nom || id}".`
    });

    return rows[0];
  }
}

module.exports = TypeSupportModel;
