const ArticleModel = require('../models/articleModel');
const PushService = require('./pushService');

/**
 * SERVICE : Logique Métier dédiée aux Articles
 */
class ArticleService {
  static async getAllArticles() {
    return await ArticleModel.getAll();
  }

  static async getArticleById(id) {
    const article = await ArticleModel.getById(id);
    if (!article) {
      const error = new Error('Article non trouvé');
      error.statusCode = 404;
      throw error;
    }
    return article;
  }

  static async createArticle(articleData) {
    // Validation métier basique
    if (!articleData.title) {
      const error = new Error('Le titre de l\'article est obligatoire');
      error.statusCode = 400;
      throw error;
    }

    const newArticle = await ArticleModel.create(articleData);

    // Notification Push facultative pour création d'article individuel
    await PushService.sendNotificationToTopic(
      'articles',
      '✨ Nouvel Article Créé',
      `L'article "${newArticle.title}" a été publié.`
    );

    return newArticle;
  }

  static async deleteArticle(id) {
    const deleted = await ArticleModel.delete(id);
    if (!deleted) {
      const error = new Error('Impossible de supprimer: article non trouvé');
      error.statusCode = 404;
      throw error;
    }
    return deleted;
  }
}

module.exports = ArticleService;
