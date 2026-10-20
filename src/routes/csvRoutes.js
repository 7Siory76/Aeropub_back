const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const CsvController = require('../controllers/csvController');

/**
 * ROUTE : POST /api/csv/upload
 * Utilise le middleware Multer `upload.single('file')` pour intercepter le fichier dans FormData
 */
router.post('/upload', upload.single('file'), CsvController.uploadCsv);
router.post('/import-infrastructure', upload.single('file'), CsvController.importInfrastructure);
router.post('/import-clients', upload.single('file'), CsvController.importClients);
router.post('/import-abonnements', upload.single('file'), CsvController.importAbonnements);

module.exports = router;
