const ZoneService = require('../services/zoneService');

class ZoneController {
  static async getAll(req, res) {
    try {
      const data = await ZoneService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await ZoneService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await ZoneService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Zone créée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await ZoneService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Zone mise à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await ZoneService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Zone supprimée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async getAllAeroports(req, res) {
    try {
      const data = await ZoneService.getAllAeroports();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getAllPerimetres(req, res) {
    try {
      const data = await ZoneService.getAllPerimetres();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = ZoneController;
