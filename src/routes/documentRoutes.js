const express = require('express');
const router = express.Router();
const DocumentController = require('../controllers/documentController');
const documentUpload = require('../config/documentMulter');

router.get('/', DocumentController.getAll);
router.get('/abonnement/:reference', DocumentController.getByAbonnement);
router.get('/:id', DocumentController.getById);
router.post('/upload', documentUpload.single('file'), DocumentController.upload);
router.post('/', DocumentController.create);
router.delete('/:id', DocumentController.delete);

module.exports = router;
