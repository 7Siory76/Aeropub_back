const ModeleCourrielService = require('../services/modeleCourrielService');

class ModeleCourrielController {
  static async getAll(req, res) {
    try {
      const data = await ModeleCourrielService.getAll();
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async getByCode(req, res) {
    try {
      const data = await ModeleCourrielService.getByCode(req.params.code);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async updateByCode(req, res) {
    try {
      const data = await ModeleCourrielService.updateByCode(req.params.code, req.body);
      return res.status(200).json({ status: 'success', message: 'Modèle de courriel mis à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = ModeleCourrielController;
