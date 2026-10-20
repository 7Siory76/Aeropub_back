const DocumentModel = require('../models/documentModel');
const path = require('path');
const fs = require('fs');

class DocumentService {
  static async getAll() {
    return DocumentModel.getAll();
  }

  static async getById(id) {
    const document = await DocumentModel.getById(id);
    if (!document) {
      const error = new Error(`Document introuvable avec l'identifiant ${id}.`);
      error.status = 404;
      throw error;
    }
    return document;
  }

  static async getByAbonnement(reference) {
    return DocumentModel.getByAbonnement(reference);
  }

  static async create(data) {
    return DocumentModel.create(data);
  }

  static async delete(id) {
    const doc = await DocumentModel.getById(id);
    if (!doc) {
      const error = new Error(`Document introuvable avec l'identifiant ${id}.`);
      error.status = 404;
      throw error;
    }
    // Suppression physique sur disque
    if (doc.url_chemin) {
      const relativePath = doc.url_chemin.replace(/^\//, '');
      const fullPath = path.join(__dirname, '../../', relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.warn('Fichier physique non supprimé :', e.message);
        }
      }
    }
    return DocumentModel.delete(id);
  }
}

module.exports = DocumentService;
