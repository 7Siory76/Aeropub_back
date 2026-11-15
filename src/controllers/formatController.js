const FormatService = require('../services/formatService');
const { sendError } = require('../utils/errorHandler');

class FormatController {
  static async getAll(req, res) {
    return res.status(200).json({ status: 'success', count: 0, data: [] });
  }

  static async getById(req, res) {
    return res.status(200).json({ status: 'success', data: null });
  }

  static async create(req, res) {
    try {
      const data = await FormatService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Format créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await FormatService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Format mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await FormatService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Format supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = FormatController;
