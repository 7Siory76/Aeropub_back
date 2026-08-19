const express = require('express');
const router = express.Router();
const ArticleController = require('../controllers/articleController');

// GET /api/articles
router.get('/', ArticleController.getAllArticles);

// GET /api/articles/:id
router.get('/:id', ArticleController.getArticleById);

// POST /api/articles
router.post('/', ArticleController.createArticle);

// DELETE /api/articles/:id
router.delete('/:id', ArticleController.deleteArticle);

module.exports = router;
