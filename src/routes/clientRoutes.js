const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/clientController');

router.get('/', ClientController.getAll);
router.get('/:id', ClientController.getById);
router.post('/', ClientController.create);
router.put('/:id', ClientController.update);
router.delete('/:id', ClientController.delete);

module.exports = router;
