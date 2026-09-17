const express = require('express');
const router = express.Router();
const Controller = require('../controllers/journalNotificationController')

router.get('/', Controller.getNotifications);
router.get('/unread-count', Controller.getUnreadCount);
router.put('/mark-all-read', Controller.markAllAsRead);
router.put('/:id/read', Controller.markAsRead);

module.exports = router;