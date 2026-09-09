const UtilisateurService = require('../services/utilisateurService');

class UtilisateurController {
  static async getAll(req, res) {
    try {
      const data = await UtilisateurService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await UtilisateurService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await UtilisateurService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Utilisateur créé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await UtilisateurService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Utilisateur mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await UtilisateurService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Utilisateur supprimé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async getAllRoles(req, res) {
    try {
      const data = await UtilisateurService.getAllRoles();
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = UtilisateurController;
