const express = require('express');
const router = express.Router();
const ZoneController = require('../controllers/zoneController');

router.get('/', ZoneController.getAll);
router.get('/aeroports', ZoneController.getAllAeroports);
router.get('/perimetres', ZoneController.getAllPerimetres);
router.get('/:id', ZoneController.getById);
router.post('/', ZoneController.create);
router.put('/:id', ZoneController.update);
router.delete('/:id', ZoneController.delete);

module.exports = router;
