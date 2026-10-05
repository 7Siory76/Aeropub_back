const TypeSupportService = require('../services/typeSupportService');
const { sendError } = require('../utils/errorHandler');

class TypeSupportController {
  static async getAll(req, res) {
    try {
      const data = await TypeSupportService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await TypeSupportService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await TypeSupportService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'TypeSupport créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await TypeSupportService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'TypeSupport mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await TypeSupportService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'TypeSupport supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = TypeSupportController;
