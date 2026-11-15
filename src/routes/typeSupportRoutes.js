const express = require('express');
const router = express.Router();
const TypeSupportController = require('../controllers/typeSupportController');

router.get('/', TypeSupportController.getAll);
router.get('/:id', TypeSupportController.getById);
router.post('/', TypeSupportController.create);
router.put('/:id', TypeSupportController.update);
router.delete('/:id', TypeSupportController.delete);

module.exports = router;
