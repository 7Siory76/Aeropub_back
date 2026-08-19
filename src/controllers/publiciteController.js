const PubliciteService = require('../services/publiciteService');

class PubliciteController {
  static async getAll(req, res) {
    try {
      const data = await PubliciteService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getByReference(req, res) {
    try {
      const data = await PubliciteService.getByReference(req.params.reference);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await PubliciteService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Publicité créée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await PubliciteService.update(req.params.reference, req.body);
      return res.status(200).json({ status: 'success', message: 'Publicité mise à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await PubliciteService.delete(req.params.reference);
      return res.status(200).json({ status: 'success', message: 'Publicité supprimée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = PubliciteController;
