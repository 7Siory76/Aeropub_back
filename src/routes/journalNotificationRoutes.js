const express = require('express');
const router = express.Router();
const Controller = require('../controllers/journalNotificationController')

router.get('/', Controller.getNotifications);
router.get('/unread-count', Controller.getUnreadCount);
router.post('/', Controller.create);
router.put('/mark-all-read', Controller.markAllAsRead);
router.put('/:id/read', Controller.markAsRead);
router.delete('/:id', Controller.delete);

module.exports = router;