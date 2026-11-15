const express = require('express');
const router = express.Router();
const CategorieController = require('../controllers/categorieController');

router.get('/', CategorieController.getAll);
router.get('/:id', CategorieController.getById);
router.post('/', CategorieController.create);
router.put('/:id', CategorieController.update);
router.delete('/:id', CategorieController.delete);

module.exports = router;
