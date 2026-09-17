const AbonnementService = require('../services/abonnementService');

class AbonnementController {
  static async getAll(req, res) {
    try {
      const data = await AbonnementService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await AbonnementService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await AbonnementService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Abonnement créé avec succès', data });
    } catch (error) {
      console.error('❌ Erreur lors de la création de l\'abonnement dans le controller:', error);
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await AbonnementService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Abonnement mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await AbonnementService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Abonnement supprimé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async getHistoriqueStatuts(req, res) {
    try {
      const data = await AbonnementService.getHistoriqueStatuts(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = AbonnementController;
