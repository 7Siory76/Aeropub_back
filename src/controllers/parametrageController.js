const ParametrageService = require('../services/parametrageService');

class ParametrageController {
  static async getAll(req, res) {
    try {
      const data = await ParametrageService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await ParametrageService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await ParametrageService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Paramétrage créé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await ParametrageService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Paramétrage mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await ParametrageService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Paramétrage supprimé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = ParametrageController;
