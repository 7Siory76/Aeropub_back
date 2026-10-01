const express = require('express');
const router = express.Router();
const ModeleCourrielController = require('../controllers/modeleCourrielController');

router.get('/', ModeleCourrielController.getAll);
router.get('/:code', ModeleCourrielController.getByCode);
router.put('/:code', ModeleCourrielController.updateByCode);

module.exports = router;
