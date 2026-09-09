const TypeStatutAbonnementService = require('../services/typeStatutAbonnementService');

class TypeStatutAbonnementController {
  static async getAll(req, res) {
    try {
      const data = await TypeStatutAbonnementService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await TypeStatutAbonnementService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await TypeStatutAbonnementService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Type de statut créé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await TypeStatutAbonnementService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Type de statut mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await TypeStatutAbonnementService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Type de statut supprimé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = TypeStatutAbonnementController;
