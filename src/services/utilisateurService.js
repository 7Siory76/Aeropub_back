const UtilisateurModel = require('../models/utilisateurModel');

class UtilisateurService {
  static async getAll() {
    return UtilisateurModel.getAll();
  }

  static async getById(id) {
    const item = await UtilisateurModel.getById(id);
    if (!item) {
      const error = new Error(`Utilisateur introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.nom || !data.email) {
      const error = new Error('Le nom et l\'email sont requis.');
      error.statusCode = 400;
      throw error;
    }
    return UtilisateurModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    return UtilisateurModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return UtilisateurModel.delete(id);
  }

  static async getAllRoles() {
    return UtilisateurModel.getAllRoles();
  }
}

module.exports = UtilisateurService;
