const TypeStatutAbonnementModel = require('../models/typeStatutAbonnementModel');

class TypeStatutAbonnementService {
  static async getAll() {
    return TypeStatutAbonnementModel.getAll();
  }

  static async getById(id) {
    const item = await TypeStatutAbonnementModel.getById(id);
    if (!item) {
      const error = new Error(`Type de statut d'abonnement introuvable avec l'ID "${id}".`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.nom_statut || !String(data.nom_statut).trim()) {
      const error = new Error('Le nom du statut (nom_statut) est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return TypeStatutAbonnementModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.nom_statut || !String(data.nom_statut).trim()) {
      const error = new Error('Le nom du statut (nom_statut) est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return TypeStatutAbonnementModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return TypeStatutAbonnementModel.delete(id);
  }
}

module.exports = TypeStatutAbonnementService;
