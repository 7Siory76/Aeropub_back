const ModeleCourrielService = require('../services/modeleCourrielService');
const { sendError } = require('../utils/errorHandler');

class ModeleCourrielController {
  static async getAll(req, res) {
    try {
      const data = await ModeleCourrielService.getAll();
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getByCode(req, res) {
    try {
      const data = await ModeleCourrielService.getByCode(req.params.code);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async updateByCode(req, res) {
    try {
      const data = await ModeleCourrielService.updateByCode(req.params.code, req.body);
      return res.status(200).json({ status: 'success', message: 'Modèle de courriel mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = ModeleCourrielController;
