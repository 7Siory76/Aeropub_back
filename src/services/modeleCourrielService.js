const ModeleCourrielModel = require('../models/modeleCourrielModel');

class ModeleCourrielService {
  static async getAll() {
    return ModeleCourrielModel.getAll();
  }

  static async getByCode(code) {
    const item = await ModeleCourrielModel.getByCode(code);
    if (!item) {
      const error = new Error(`Modèle de courriel introuvable avec le code "${code}".`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async updateByCode(code, data) {
    await this.getByCode(code);
    return ModeleCourrielModel.updateByCode(code, data);
  }
}

module.exports = ModeleCourrielService;
