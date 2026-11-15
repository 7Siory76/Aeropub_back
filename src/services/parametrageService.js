const ParametrageModel = require('../models/parametrageModel');

class ParametrageService {
  static async getAll() {
    return await ParametrageModel.getAll();
  }

  static async getById(id) {
    const parametrage = await ParametrageModel.getById(id);
    if (!parametrage) {
      const error = new Error(`Paramètre introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return parametrage;
  }

  static async create(data) {
    if (!data.nom_parametre) {
      const error = new Error('Le nom du paramètre est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return await ParametrageModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.valeur) {
      const error = new Error('La valeur du paramètre est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return await ParametrageModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await ParametrageModel.delete(id);
  }
}

module.exports = ParametrageService;
