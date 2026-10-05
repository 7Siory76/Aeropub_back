const UtilisateurService = require('../services/utilisateurService');
const UtilisateurModel = require('../models/utilisateurModel');
const bcrypt = require('bcryptjs');
const { sendError } = require('../utils/errorHandler');

class UtilisateurController {
  static async getAll(req, res) {
    try {
      const data = await UtilisateurService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await UtilisateurService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await UtilisateurService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Utilisateur créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await UtilisateurService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Utilisateur mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await UtilisateurService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Utilisateur supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getAllRoles(req, res) {
    try {
      const data = await UtilisateurService.getAllRoles();
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async login(req, res) {
    try {
      const { email, mot_de_passe } = req.body;
      if (!email || !mot_de_passe) {
        return res.status(400).json({ status: 'error', message: "Email et mot de passe requis." });
      }

      const user = await UtilisateurModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ status: 'error', message: "Identifiants invalides." });
      }

      if (!user.actif) {
        return res.status(403).json({ status: 'error', message: "Ce compte utilisateur est désactivé." });
      }

      const isBcrypt = user.mot_de_passe_hash && user.mot_de_passe_hash.startsWith('$2');
      const match = isBcrypt
        ? await bcrypt.compare(mot_de_passe, user.mot_de_passe_hash)
        : (mot_de_passe === user.mot_de_passe_hash);
      if (!match) {
        return res.status(401).json({ status: 'error', message: "Mot de passe incorrect." });
      }

      delete user.mot_de_passe_hash;

      return res.json({
        status: 'success',
        message: "connexion réussie",
        user: {
          id: user.id,
          nom: user.nom,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      return sendError(res, err);
    }
  }
}

module.exports = UtilisateurController;
