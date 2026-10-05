const ArticleService = require('../services/articleService');
const { sendError } = require('../utils/errorHandler');

/**
 * CONTROLLER : Gestion des requêtes HTTP pour les CRUD des articles
 */
class ArticleController {
  static async getAllArticles(req, res) {
    try {
      const articles = await ArticleService.getAllArticles();
      return res.status(200).json({
        status: 'success',
        count: articles.length,
        data: articles
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getArticleById(req, res) {
    try {
      const { id } = req.params;
      const article = await ArticleService.getArticleById(id);
      return res.status(200).json({
        status: 'success',
        data: article
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async createArticle(req, res) {
    try {
      const newArticle = await ArticleService.createArticle(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'Article créé avec succès',
        data: newArticle
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      const deletedArticle = await ArticleService.deleteArticle(id);
      return res.status(200).json({
        status: 'success',
        message: 'Article supprimé avec succès',
        data: deletedArticle
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = ArticleController;
