const LocalisationService = require('../services/localisationService');
const { sendError } = require('../utils/errorHandler');

class LocalisationController {
  static async getAll(req, res) {
    try {
      const data = await LocalisationService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await LocalisationService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await LocalisationService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Localisation créée avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await LocalisationService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Localisation mise à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await LocalisationService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Localisation supprimée avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = LocalisationController;
