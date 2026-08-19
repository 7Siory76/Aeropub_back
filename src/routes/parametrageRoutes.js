const express = require('express');
const router = express.Router();
const ParametrageController = require('../controllers/parametrageController');

router.get('/', ParametrageController.getAll);
router.get('/:id', ParametrageController.getById);
router.post('/', ParametrageController.create);
router.put('/:id', ParametrageController.update);
router.delete('/:id', ParametrageController.delete);

module.exports = router;
