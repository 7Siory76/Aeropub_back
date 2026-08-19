const express = require('express');
const router = express.Router();
const LocalisationController = require('../controllers/localisationController');

router.get('/', LocalisationController.getAll);
router.get('/:id', LocalisationController.getById);
router.post('/', LocalisationController.create);
router.put('/:id', LocalisationController.update);
router.delete('/:id', LocalisationController.delete);

module.exports = router;
