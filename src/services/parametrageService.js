const ParametrageModel = require('../models/parametrageModel');

class ParametrageService {
  static async getAll() {
    return await ParametrageModel.getAll();
  }

  static async getById(id) {
    const item = await ParametrageModel.getById(id);
    if (!item) {
      const error = new Error(`Paramétrage avec l'ID ${id} non trouvé`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.nom_parametre) {
      const error = new Error('Le champ nom_parametre est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await ParametrageModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.valeur) {
      const error = new Error('Le champ valeur est obligatoire');
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
