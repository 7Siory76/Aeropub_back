const JournalNotificationModel = require('../models/journalNotificationModel');

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
            return res.status(500).json({ status: 'error', message: err.message })
        }
    }
    static async getUnreadCount(req, res) {
        try {
            const count = await JournalNotificationModel.getUnreadCount();
            return res.status(200).json({ status: 'success', unreadCount: count });
        } catch (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
    }
    static async markAsRead(req, res) {
        try {
            const updated = await JournalNotificationModel.markAsRead(req.params.id);
            return res.status(200).json({ status: 'success', data: updated });
        } catch (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
    }
    static async markAllAsRead(req, res) {
        try {
            await JournalNotificationModel.markAllAsRead();
            return res.status(200).json({ status: 'success', message: 'Toutes les notifications sont marquées comme lues' });
        } catch (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
    }
}

module.exports = JournalNotificationController;