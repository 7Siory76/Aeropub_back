const express = require('express');
const router = express.Router();
const AbonnementController = require('../controllers/abonnementController');

router.get('/', AbonnementController.getAll);
router.get('/:id', AbonnementController.getById);
router.get('/:id/statuts', AbonnementController.getHistoriqueStatuts);
router.get('/:id/historique-statuts', AbonnementController.getHistoriqueStatuts);
router.post('/', AbonnementController.create);
router.put('/:id', AbonnementController.update);
router.delete('/:id', AbonnementController.delete);

module.exports = router;
