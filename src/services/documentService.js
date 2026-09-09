const DocumentModel = require('../models/documentModel');

class DocumentService {
  static async getAll() {
    return DocumentModel.getAll();
  }

  static async getById(id) {
    const item = await DocumentModel.getById(id);
    if (!item) {
      const error = new Error(`Document introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.nom_fichier || !data.url_chemin) {
      const error = new Error('Le nom et le chemin du fichier sont requis.');
      error.statusCode = 400;
      throw error;
    }
    return DocumentModel.create(data);
  }

  static async delete(id) {
    await this.getById(id);
    return DocumentModel.delete(id);
  }
}

module.exports = DocumentService;
