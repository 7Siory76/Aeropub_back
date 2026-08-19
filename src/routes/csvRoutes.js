const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const CsvController = require('../controllers/csvController');

/**
 * ROUTE : POST /api/csv/upload
 * Utilise le middleware Multer `upload.single('file')` pour intercepter le fichier dans FormData
 */
router.post('/upload', upload.single('file'), CsvController.uploadCsv);

module.exports = router;
