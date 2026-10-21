const JournalNotificationModel = require('../models/journalNotificationModel');
const { sendError } = require('../utils/errorHandler');

class JournalNotificationController {
    static async getNotifications(req, res) {
        try {
            const { categorie, nonLu, limit } = req.query;
            const data = await JournalNotificationModel.getAll({
                categorie,
                nonLuSeulement: nonLu,
                limit
            });
            const unreadCount = await JournalNotificationModel.getUnreadCount();
            return res.status(200).json({ status: 'success', unreadCount, count: data.length, data });
        } catch (err) {
            return sendError(res, err);
        }
    }

    static async getUnreadCount(req, res) {
        try {
            const count = await JournalNotificationModel.getUnreadCount();
            return res.status(200).json({ status: 'success', unreadCount: count });
        } catch (err) {
            return sendError(res, err);
        }
    }

    static async markAsRead(req, res) {
        try {
            const updated = await JournalNotificationModel.markAsRead(req.params.id);
            return res.status(200).json({ status: 'success', data: updated });
        } catch (err) {
            return sendError(res, err);
        }
    }

    static async markAllAsRead(req, res) {
        try {
            await JournalNotificationModel.markAllAsRead();
            return res.status(200).json({ status: 'success', message: 'Toutes les notifications ont été marquées comme lues' });
        } catch (err) {
            return sendError(res, err);
        }
    }

    static async create(req, res) {
        try {
            const { id_utilisateur, categorie_action, entite_concernee, reference_entite, valeur_apres, message_notification } = req.body;
            const created = await JournalNotificationModel.logAction({
                id_utilisateur: id_utilisateur ? parseInt(id_utilisateur, 10) : null,
                categorie_action: categorie_action || 'INFO',
                entite_concernee: entite_concernee || 'SYSTEME',
                reference_entite: String(reference_entite || 'GLOBAL'),
                valeur_apres: valeur_apres || null,
                message_notification: message_notification || 'Action enregistrée'
            });
            return res.status(201).json({ status: 'success', data: created });
        } catch (err) {
            return sendError(res, err);
        }
    }

    static async delete(req, res) {
        try {
            const deleted = await JournalNotificationModel.delete(req.params.id);
            if (!deleted) {
                return res.status(404).json({ status: 'error', message: 'Notification introuvable' });
            }
            return res.status(200).json({ status: 'success', message: 'Notification supprimée avec succès', data: deleted });
        } catch (err) {
            return sendError(res, err);
        }
    }
}

module.exports = JournalNotificationController;