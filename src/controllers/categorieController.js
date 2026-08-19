const CategorieService = require('../services/categorieService');

class CategorieController {
  static async getAll(req, res) {
    try {
      const data = await CategorieService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const data = await CategorieService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = await CategorieService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Catégorie créée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const data = await CategorieService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Catégorie mise à jour avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await CategorieService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Catégorie supprimée avec succès', data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = CategorieController;
