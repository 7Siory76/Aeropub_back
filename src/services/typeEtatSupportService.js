const TypeEtatSupportModel = require('../models/typeEtatSupportModel');

class TypeEtatSupportService {
  static async getAll() {
    return TypeEtatSupportModel.getAll();
  }

  static async getById(id) {
    const item = await TypeEtatSupportModel.getById(id);
    if (!item) {
      const error = new Error(`Type d'état de support introuvable avec l'ID "${id}".`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.nom_etat || !String(data.nom_etat).trim()) {
      const error = new Error('Le nom de l\'état (nom_etat) est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return TypeEtatSupportModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.nom_etat || !String(data.nom_etat).trim()) {
      const error = new Error('Le nom de l\'état (nom_etat) est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return TypeEtatSupportModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return TypeEtatSupportModel.delete(id);
  }
}

module.exports = TypeEtatSupportService;
