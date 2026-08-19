const express = require('express');
const router = express.Router();
const FormatController = require('../controllers/formatController');

router.get('/', FormatController.getAll);
router.get('/:id', FormatController.getById);
router.post('/', FormatController.create);
router.put('/:id', FormatController.update);
router.delete('/:id', FormatController.delete);

module.exports = router;
