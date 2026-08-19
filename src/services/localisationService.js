const LocalisationModel = require('../models/localisationModel');

class LocalisationService {
  static async getAll() {
    return await LocalisationModel.getAll();
  }

  static async getById(id) {
    const loc = await LocalisationModel.getById(id);
    if (!loc) {
      const error = new Error(`Localisation avec l'ID ${id} non trouvée`);
      error.statusCode = 404;
      throw error;
    }
    return loc;
  }

  static async create(data) {
    if (!data.nom_lieu || !data.id_zone) {
      const error = new Error('Les champs nom_lieu et id_zone sont obligatoires');
      error.statusCode = 400;
      throw error;
    }
    return await LocalisationModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.nom_lieu || !data.id_zone) {
      const error = new Error('Les champs nom_lieu et id_zone sont obligatoires');
      error.statusCode = 400;
      throw error;
    }
    return await LocalisationModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await LocalisationModel.delete(id);
  }
}

module.exports = LocalisationService;
