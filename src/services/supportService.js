const SupportModel = require('../models/supportModel');

class SupportService {
  static async getAll() {
    return SupportModel.getAll();
  }

  static async getByReference(reference) {
    const item = await SupportModel.getByReference(reference);
    if (!item) {
      const error = new Error(`Support avec la référence "${reference}" introuvable.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.reference) {
      const error = new Error('La référence du support est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return SupportModel.create(data);
  }

  static async update(reference, data) {
    await this.getByReference(reference);
    return SupportModel.update(reference, data);
  }

  static async delete(reference) {
    await this.getByReference(reference);
    return SupportModel.delete(reference);
  }

  static async getHistoriqueEtats(reference) {
    return SupportModel.getHistoriqueEtats(reference);
  }
}

module.exports = SupportService;
