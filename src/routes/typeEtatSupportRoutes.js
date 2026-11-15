const express = require('express');
const router = express.Router();
const TypeEtatSupportController = require('../controllers/typeEtatSupportController');

router.get('/', TypeEtatSupportController.getAll);
router.get('/:id', TypeEtatSupportController.getById);
router.post('/', TypeEtatSupportController.create);
router.put('/:id', TypeEtatSupportController.update);
router.delete('/:id', TypeEtatSupportController.delete);

module.exports = router;
