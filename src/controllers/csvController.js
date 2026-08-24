const CsvService = require('../services/csvService');

class CsvController {
  static async uploadCsv(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Veuillez transmettre un fichier CSV dans le champ "file".'
        });
      }
      console.log(`Fichier CSV reçu : ${req.file.originalname}`);
      const result = await CsvService.processCsvFile(req.file.path);

      return res.status(200).json({
        status: 'success',
        message: 'Importation CSV réussie !',
        data: result
      });

    } catch (error) {
      console.error('❌ Erreur Import CSV :', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erreur lors du traitement du fichier CSV.',
        details: error.message
      });
    }
  }
}

module.exports = CsvController;