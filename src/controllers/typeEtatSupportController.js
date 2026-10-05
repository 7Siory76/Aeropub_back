const TypeEtatSupportService = require('../services/typeEtatSupportService');
const { sendError } = require('../utils/errorHandler');

class TypeEtatSupportController {
  static async getAll(req, res) {
    try {
      const data = await TypeEtatSupportService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await TypeEtatSupportService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await TypeEtatSupportService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Type d\'état créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await TypeEtatSupportService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Type d\'état mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await TypeEtatSupportService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Type d\'état supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = TypeEtatSupportController;
