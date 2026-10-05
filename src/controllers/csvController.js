const CsvService = require('../services/csvService');
const { sendError } = require('../utils/errorHandler');

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
      return sendError(res, error);
    }
  }
}

module.exports = CsvController;