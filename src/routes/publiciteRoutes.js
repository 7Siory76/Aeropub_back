const express = require('express');
const router = express.Router();
const PubliciteController = require('../controllers/publiciteController');

router.get('/', PubliciteController.getAll);
router.get('/:reference', PubliciteController.getByReference);
router.post('/', PubliciteController.create);
router.put('/:reference', PubliciteController.update);
router.delete('/:reference', PubliciteController.delete);

module.exports = router;
