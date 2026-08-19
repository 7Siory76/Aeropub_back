const EmplacementModel = require('./emplacementModel');

// Alias de rétro-compatibilité : PubliciteModel redirige vers EmplacementModel
class PubliciteModel {
  static async getAll() {
    return await EmplacementModel.getAll();
  }

  static async getByReference(ref) {
    return await EmplacementModel.getByReference(ref);
  }

  static async create(data) {
    return await EmplacementModel.create(data);
  }

  static async update(ref, data) {
    return await EmplacementModel.update(ref, data);
  }

  static async delete(ref) {
    return await EmplacementModel.delete(ref);
  }
}

module.exports = PubliciteModel;
