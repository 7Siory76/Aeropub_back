const express = require('express');
const router = express.Router();
const DocumentController = require('../controllers/documentController');

router.get('/', DocumentController.getAll);
router.get('/:id', DocumentController.getById);
router.post('/', DocumentController.create);
router.delete('/:id', DocumentController.delete);

module.exports = router;
