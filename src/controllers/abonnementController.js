const AbonnementService = require('../services/abonnementService');
const { sendError } = require('../utils/errorHandler');

class AbonnementController {
  static async getAll(req, res) {
    try {
      const listeAbonnements = await AbonnementService.getAll();
      return res.status(200).json({ status: 'success', count: listeAbonnements.length, data: listeAbonnements });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const abonnement = await AbonnementService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: abonnement });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const nouvelAbonnement = await AbonnementService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Abonnement créé avec succès', data: nouvelAbonnement });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const abonnementMisAJour = await AbonnementService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Abonnement mis à jour avec succès', data: abonnementMisAJour });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const abonnementSupprime = await AbonnementService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Abonnement supprimé avec succès', data: abonnementSupprime });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getHistoriqueStatuts(req, res) {
    try {
      const historiqueStatuts = await AbonnementService.getHistoriqueStatuts(req.params.id);
      return res.status(200).json({ status: 'success', data: historiqueStatuts });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = AbonnementController;
