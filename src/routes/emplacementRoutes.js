const express = require('express');
const router = express.Router();
const EmplacementController = require('../controllers/emplacementController');

router.get('/', EmplacementController.getAll);
router.get('/:reference', EmplacementController.getByReference);
router.post('/', EmplacementController.create);
router.put('/:reference', EmplacementController.update);
router.delete('/:reference', EmplacementController.delete);

module.exports = router;
