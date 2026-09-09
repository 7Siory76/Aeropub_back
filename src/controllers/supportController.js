const SupportService = require('../services/supportService');

class SupportController {
  static async getAll(req, res) {
    try {
      const data = await SupportService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getByReference(req, res) {
    try {
      const data = await SupportService.getByReference(req.params.reference);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await SupportService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Support créé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await SupportService.update(req.params.reference, req.body);
      return res.status(200).json({ status: 'success', message: 'Support mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await SupportService.delete(req.params.reference);
      return res.status(200).json({ status: 'success', message: 'Support supprimé avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async getHistoriqueEtats(req, res) {
    try {
      const data = await SupportService.getHistoriqueEtats(req.params.reference);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = SupportController;
