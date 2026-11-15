const express = require('express');
const router = express.Router();
const UtilisateurController = require('../controllers/utilisateurController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Route publique : Connexion
router.post('/login', UtilisateurController.login);

// Routes protégées : Gestion des utilisateurs
router.get('/', authMiddleware, UtilisateurController.getAll);
router.get('/roles', authMiddleware, UtilisateurController.getAllRoles);
router.get('/:id', authMiddleware, UtilisateurController.getById);
router.post('/', authMiddleware, UtilisateurController.create);
router.put('/:id', authMiddleware, UtilisateurController.update);
router.delete('/:id', authMiddleware, UtilisateurController.delete);

module.exports = router;
