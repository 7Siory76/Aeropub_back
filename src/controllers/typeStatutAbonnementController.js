const TypeStatutAbonnementService = require('../services/typeStatutAbonnementService');
const { sendError } = require('../utils/errorHandler');

class TypeStatutAbonnementController {
  static async getAll(req, res) {
    try {
      const data = await TypeStatutAbonnementService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await TypeStatutAbonnementService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await TypeStatutAbonnementService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Type de statut créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await TypeStatutAbonnementService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Type de statut mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await TypeStatutAbonnementService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Type de statut supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = TypeStatutAbonnementController;
