const db = require('../config/db');

class JournalNotificationModel {
    /**
   * Enregistrer une nouvelle action dans le journal
   */
    static async logAction({
        id_utilisateur = null,
        categorie_action,
        entite_concernee,
        reference_entite,
        valeur_apres = null,
        message_notification
    }) {
        try {
            const querry = `
            INSERT INTO Journal_Notification (
            id_utilisateur,
            categorie_action,
            entite_concernee,
            reference_entite,
            valeur_apres,
            message_notification
            ) VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *;
            `;

            const values = [
                id_utilisateur,
                categorie_action.toUpperCase(),
                entite_concernee.toUpperCase(),
                String(reference_entite),
                valeur_apres ? JSON.stringify(valeur_apres) : null,
                message_notification
            ];

            const { rows } = await db.query(querry, values);
            return rows[0];
        } catch (err) {
            console.error('Erreur écriture Journal_Notification:', err);
            return null;
        }
    }
    static async getAll({ categorie = null, nonLuSeulement = false, limit = 50 } = {}) {
        let querry = `
        SELECT jn.*,
        u.nom AS nom_utilisateur,
        u.email AS email_utilisateur
        FROM Journal_Notification jn
        LEFT JOIN Utilisateur u ON jn.id_utilisateur = u.id
        WHERE 1=1
        `;

        const params = [];

        if (categorie && categorie !== 'TOUTES') {
            params.push(categorie.tuUpperCase());
            querry += `AND jn.categorie_action = $${params.length}`
        }
        if (nonLuSeulement === true || nonLuSeulement === 'true') {
            querry += ` AND jn.lu_par_admin = FALSE`;
        }
        querry += ` ORDER BY jn.date_action DESC LIMIT $${params.length + 1};`;
        params.push(parseInt(limit, 10) || 50);

        const { rows } = await db.query(querry, params);
        return rows;
    }

    /**
   * Compter le nombre de notifications non lues
   */
    static async getUnreadCount() {
        const { rows } = await db.query('SELECT COUNT(*) AS unread FROM Journal_Notification WHERE lu_par_admin = FALSE;');
        return parseInt(rows[0].unread, 10) || 0;
    }
    /**
    * Marquer une notification comme lue
    */
    static async markAsRead(id) {
        const { rows } = await db.query('UPDATE Journal_Notification SET lu_par_admin = TRUE WHERE id = $1 RETURNING *;',
            [id]
        );
        return rows[0];
    }
    /**
    * Tout marquer comme lu
    */
    static async markAllAsRead() {
        await db.query('UPDATE Journal_Notification SET lu_par_admin = TRUE WHERE lu_par_admin = FALSE;');
        return { success: true };
    }
}

module.exports = JournalNotificationModel;