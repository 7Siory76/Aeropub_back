const express = require('express');
const router = express.Router();
const TypeStatutAbonnementController = require('../controllers/typeStatutAbonnementController');

router.get('/', TypeStatutAbonnementController.getAll);
router.get('/:id', TypeStatutAbonnementController.getById);
router.post('/', TypeStatutAbonnementController.create);
router.put('/:id', TypeStatutAbonnementController.update);
router.delete('/:id', TypeStatutAbonnementController.delete);

module.exports = router;
