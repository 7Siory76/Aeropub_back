const ActionCommercialeService = require('../services/actionCommercialeService');

class ActionCommercialeController {
  static async getAll(req, res) {
    try {
      const data = await ActionCommercialeService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await ActionCommercialeService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await ActionCommercialeService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Action commerciale enregistrée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await ActionCommercialeService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Action commerciale mise à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await ActionCommercialeService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Action commerciale supprimée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = ActionCommercialeController;
