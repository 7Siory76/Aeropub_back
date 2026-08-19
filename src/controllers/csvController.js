const CsvService = require('../services/csvService');

/**
 * CONTROLLER : Gestion de la couche HTTP pour l'import CSV
 * Récupère req/res, effectue la réponse HTTP et délègue la logique métier au Service.
 */
class CsvController {
  /**
   * Endpoint POST pour récevoir et importer un fichier CSV
   */
  static async uploadCsv(req, res) {
    try {
      // 1. Vérification si un fichier a été téléversé via Multer
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Fichier manquant ! Veuillez envoyer un fichier CSV dans la propriété "file".'
        });
      }

      console.log(`📥 Réception du fichier CSV: ${req.file.originalname} (${req.file.size} octets)`);

      // 2. Appel du Service Métier pour parser et sauvegarder le fichier
      const result = await CsvService.processCsvFile(req.file.path);

      // 3. Renvoi de la réponse HTTP 200 Succès
      return res.status(200).json({
        status: 'success',
        message: 'Fichier CSV importé et traité avec succès !',
        data: result
      });

    } catch (error) {
      console.error('❌ Erreur Controller CSV:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Une erreur est survenue lors du traitement du fichier CSV.',
        details: error.message
      });
    }
  }
}

module.exports = CsvController;
