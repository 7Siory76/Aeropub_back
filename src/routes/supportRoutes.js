const express = require('express');
const router = express.Router();
const SupportController = require('../controllers/supportController');

router.get('/', SupportController.getAll);
router.get('/:reference', SupportController.getByReference);
router.get('/:reference/etats', SupportController.getHistoriqueEtats);
router.post('/', SupportController.create);
router.put('/:reference', SupportController.update);
router.delete('/:reference', SupportController.delete);

module.exports = router;
