const express = require('express');
const router = express.Router();
const ActionCommercialeController = require('../controllers/actionCommercialeController');

router.get('/', ActionCommercialeController.getAll);
router.post('/relance-manuelle', ActionCommercialeController.envoyerRelanceManuelle);
router.get('/:id', ActionCommercialeController.getById);
router.post('/', ActionCommercialeController.create);
router.put('/:id', ActionCommercialeController.update);
router.delete('/:id', ActionCommercialeController.delete);

module.exports = router;
