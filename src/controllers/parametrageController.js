const ParametrageService = require('../services/parametrageService');
const { sendError } = require('../utils/errorHandler');

class ParametrageController {
  static async getAll(req, res) {
    try {
      const data = await ParametrageService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await ParametrageService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await ParametrageService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Paramétrage créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await ParametrageService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Paramétrage mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await ParametrageService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Paramétrage supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = ParametrageController;
