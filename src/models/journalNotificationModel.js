const db = require('../config/db');

class JournalNotificationModel {
    static _tableReady = false;

    /**
     * Garantit que la table Journal_Notification existe toujours,
     * même sur un environnement fraîchement déployé (Vercel, Koyeb, Docker).
     */
    static async ensureTable() {
        if (this._tableReady) return;
        try {
            const check = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_notification' LIMIT 1");
            if (check.rows.length > 0) {
                this._tableReady = true;
                return;
            }

            await db.query(`
                CREATE TABLE IF NOT EXISTS Journal_Notification (
                    id SERIAL PRIMARY KEY,
                    date_action TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    id_utilisateur INT REFERENCES Utilisateur(id) ON DELETE SET NULL,
                    categorie_action VARCHAR(50) NOT NULL, 
                    entite_concernee VARCHAR(50) NOT NULL,
                    reference_entite VARCHAR(255) NOT NULL, 
                    valeur_apres JSONB, 
                    message_notification TEXT NOT NULL, 
                    lu_par_admin BOOLEAN DEFAULT FALSE
                );
            `);
            try {
                await db.query(`
                    CREATE INDEX IF NOT EXISTS idx_journal_notif_date ON Journal_Notification(date_action DESC);
                    CREATE INDEX IF NOT EXISTS idx_journal_notif_lu ON Journal_Notification(lu_par_admin) WHERE lu_par_admin = FALSE;
                `);
            } catch (_) {}
            this._tableReady = true;
        } catch (err) {
            console.warn('⚠️ [JOURNAL] Avertissement ensureTable:', err.message);
        }
    }

    /**
     * Enregistrer une nouvelle action dans le journal
     */
    static async logAction({
        id_utilisateur = null,
        categorie_action = 'INFO',
        entite_concernee = 'SYSTEME',
        reference_entite = 'GLOBAL',
        valeur_apres = null,
        message_notification = 'Action enregistrée'
    }) {
        try {
            await this.ensureTable();

            // Vérification de sécurité pour la clé étrangère id_utilisateur
            let validUserId = null;
            if (id_utilisateur) {
                const parsedId = parseInt(id_utilisateur, 10);
                if (!isNaN(parsedId) && parsedId > 0) {
                    try {
                        const uCheck = await db.query('SELECT 1 FROM Utilisateur WHERE id = $1', [parsedId]);
                        if (uCheck.rows.length > 0) {
                            validUserId = parsedId;
                        }
                    } catch (_) {
                        validUserId = null;
                    }
                }
            }

            const cleanCat = String(categorie_action || 'INFO').toUpperCase().slice(0, 50);
            const cleanEnt = String(entite_concernee || 'SYSTEME').toUpperCase().slice(0, 50);
            const cleanRef = String(reference_entite || 'GLOBAL').slice(0, 255);
            const cleanMsg = String(message_notification || 'Action enregistrée dans le journal');

            let jsonValeur = null;
            if (valeur_apres !== null && valeur_apres !== undefined) {
                try {
                    jsonValeur = typeof valeur_apres === 'string' ? valeur_apres : JSON.stringify(valeur_apres);
                } catch (_) {
                    jsonValeur = null;
                }
            }

            const query = `
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
                validUserId,
                cleanCat,
                cleanEnt,
                cleanRef,
                jsonValeur,
                cleanMsg
            ];

            const { rows } = await db.query(query, values);
            return rows[0];
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] Échec écriture Journal_Notification:', err.message);
            return null;
        }
    }

    static async getAll({ categorie = null, nonLuSeulement = false, limit = 500 } = {}) {
        await this.ensureTable();

        try {
            let query = `
                SELECT 
                    jn.id,
                    jn.id_utilisateur,
                    jn.categorie_action,
                    jn.entite_concernee,
                    jn.reference_entite,
                    jn.valeur_apres,
                    jn.message_notification,
                    jn.date_action,
                    jn.lu_par_admin,
                    u.nom AS nom_utilisateur,
                    u.email AS email_utilisateur
                FROM Journal_Notification jn
                LEFT JOIN Utilisateur u ON jn.id_utilisateur = u.id
                WHERE 1=1
            `;

            const params = [];

            if (categorie && categorie !== 'TOUTES') {
                params.push(categorie.toUpperCase());
                query += ` AND jn.categorie_action = $${params.length}`;
            }
            if (nonLuSeulement === true || nonLuSeulement === 'true') {
                query += ` AND jn.lu_par_admin = FALSE`;
            }
            params.push(parseInt(limit, 10) || 500);
            query += ` ORDER BY jn.date_action DESC LIMIT $${params.length};`;

            const { rows } = await db.query(query, params);
            return rows;
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] getAll():', err.message);
            return [];
        }
    }

    /**
     * Compter le nombre de notifications non lues
     */
    static async getUnreadCount() {
        await this.ensureTable();
        try {
            const { rows } = await db.query('SELECT COUNT(*) AS unread FROM Journal_Notification WHERE lu_par_admin = FALSE;');
            return parseInt(rows[0]?.unread, 10) || 0;
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] getUnreadCount():', err.message);
            return 0;
        }
    }

    /**
     * Marquer une notification comme lue
     */
    static async markAsRead(id) {
        await this.ensureTable();
        try {
            const { rows } = await db.query(
                'UPDATE Journal_Notification SET lu_par_admin = TRUE WHERE id = $1 RETURNING *;',
                [id]
            );
            return rows[0] || null;
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] markAsRead():', err.message);
            return null;
        }
    }

    /**
     * Tout marquer comme lu
     */
    static async markAllAsRead() {
        await this.ensureTable();
        try {
            await db.query('UPDATE Journal_Notification SET lu_par_admin = TRUE WHERE lu_par_admin = FALSE;');
            return { success: true };
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] markAllAsRead():', err.message);
            return { success: false };
        }
    }

    /**
     * Supprimer une notification par son identifiant
     */
    static async delete(id) {
        await this.ensureTable();
        try {
            const { rows } = await db.query('DELETE FROM Journal_Notification WHERE id = $1 RETURNING *;', [id]);
            return rows[0] || null;
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] delete():', err.message);
            return null;
        }
    }

    /**
     * Récupérer la liste des catégories d'action distinctes enregistrées dans le journal
     */
    static async getCategories() {
        await this.ensureTable();
        try {
            const { rows } = await db.query(`
                SELECT DISTINCT categorie_action
                FROM Journal_Notification
                WHERE categorie_action IS NOT NULL AND TRIM(categorie_action) != ''
                ORDER BY categorie_action ASC;
            `);
            return rows.map(r => r.categorie_action);
        } catch (err) {
            console.error('❌ [JOURNAL ERROR] getCategories():', err.message);
            return [];
        }
    }
}

module.exports = JournalNotificationModel;