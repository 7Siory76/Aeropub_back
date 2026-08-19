const EmplacementModel = require('../models/emplacementModel');

class EmplacementService {
  static async getAll() {
    return await EmplacementModel.getAll();
  }

  static async getByReference(ref) {
    const item = await EmplacementModel.getByReference(ref);
    if (!item) {
      const error = new Error(`Emplacement avec la référence ${ref} non trouvé`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.reference || !data.id_format || !data.id_type_support || !data.id_localisation) {
      const error = new Error('Les champs reference, id_format, id_type_support et id_localisation sont obligatoires');
      error.statusCode = 400;
      throw error;
    }
    return await EmplacementModel.create(data);
  }

  static async update(ref, data) {
    await this.getByReference(ref);
    if (!data.id_format || !data.id_type_support || !data.id_localisation) {
      const error = new Error('Les champs id_format, id_type_support et id_localisation sont obligatoires');
      error.statusCode = 400;
      throw error;
    }
    return await EmplacementModel.update(ref, data);
  }

  static async delete(ref) {
    await this.getByReference(ref);
    return await EmplacementModel.delete(ref);
  }
}

module.exports = EmplacementService;
