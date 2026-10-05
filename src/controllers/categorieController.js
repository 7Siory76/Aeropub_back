const CategorieService = require('../services/categorieService');
const { sendError } = require('../utils/errorHandler');

class CategorieController {
  static async getAll(req, res) {
    try {
      const data = await CategorieService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await CategorieService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await CategorieService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Catégorie créée avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await CategorieService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Catégorie mise à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await CategorieService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Catégorie supprimée avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = CategorieController;
