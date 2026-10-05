const AbonnementService = require('../services/abonnementService');
const { sendError } = require('../utils/errorHandler');

class AbonnementController {
  static async getAll(req, res) {
    try {
      const data = await AbonnementService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await AbonnementService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await AbonnementService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Abonnement créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await AbonnementService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Abonnement mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await AbonnementService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Abonnement supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getHistoriqueStatuts(req, res) {
    try {
      const data = await AbonnementService.getHistoriqueStatuts(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = AbonnementController;
