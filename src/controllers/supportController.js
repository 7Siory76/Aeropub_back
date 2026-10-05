const SupportService = require('../services/supportService');
const { sendError } = require('../utils/errorHandler');

class SupportController {
  static async getAll(req, res) {
    try {
      const data = await SupportService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getByReference(req, res) {
    try {
      const data = await SupportService.getByReference(req.params.reference);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }


  static async create(req, res) {
    try {
      const data = await SupportService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Support créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await SupportService.update(req.params.reference, req.body);
      return res.status(200).json({ status: 'success', message: 'Support mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await SupportService.delete(req.params.reference);
      return res.status(200).json({ status: 'success', message: 'Support supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getHistoriqueEtats(req, res) {
    try {
      const data = await SupportService.getHistoriqueEtats(req.params.reference);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = SupportController;
