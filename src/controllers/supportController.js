const SupportService = require('../services/supportService');
const { sendError } = require('../utils/errorHandler');

class SupportController {
  static async getAll(req, res) {
    try {
      const listeSupports = await SupportService.getAll();
      return res.status(200).json({ status: 'success', count: listeSupports.length, data: listeSupports });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getByReference(req, res) {
    try {
      const support = await SupportService.getByReference(req.params.reference);
      return res.status(200).json({ status: 'success', data: support });
    } catch (error) {
      return sendError(res, error);
    }
  }


  static async create(req, res) {
    try {
      const nouveauSupport = await SupportService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Support créé avec succès', data: nouveauSupport });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const supportMisAJour = await SupportService.update(req.params.reference, req.body);
      return res.status(200).json({ status: 'success', message: 'Support mis à jour avec succès', data: supportMisAJour });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const supportSupprime = await SupportService.delete(req.params.reference);
      return res.status(200).json({ status: 'success', message: 'Support supprimé avec succès', data: supportSupprime });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getHistoriqueEtats(req, res) {
    try {
      const historiqueEtats = await SupportService.getHistoriqueEtats(req.params.reference);
      return res.status(200).json({ status: 'success', data: historiqueEtats });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = SupportController;
