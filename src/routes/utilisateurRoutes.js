const express = require('express');
const router = express.Router();
const UtilisateurController = require('../controllers/utilisateurController');

router.get('/', UtilisateurController.getAll);
router.get('/roles', UtilisateurController.getAllRoles);
router.get('/:id', UtilisateurController.getById);
router.post('/', UtilisateurController.create);
router.put('/:id', UtilisateurController.update);
router.delete('/:id', UtilisateurController.delete);
router.post('/login', UtilisateurController.login);

module.exports = router;
