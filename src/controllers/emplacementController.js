const EmplacementService = require('../services/emplacementService');

class EmplacementController {
  static async getAll(req, res) {
    try {
      const data = await EmplacementService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getByReference(req, res) {
    try {
      const data = await EmplacementService.getByReference(req.params.reference);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await EmplacementService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Emplacement créé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await EmplacementService.update(req.params.reference, req.body);
      return res.status(200).json({ status: 'success', message: 'Emplacement mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await EmplacementService.delete(req.params.reference);
      return res.status(200).json({ status: 'success', message: 'Emplacement supprimé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = EmplacementController;
