const SupportModel = require('./supportModel');

/**
 * EmplacementModel : Adaptateur et alias rétro-compatible pointant vers SupportModel
 */
class EmplacementModel {
  static async getAll() {
    return SupportModel.getAll();
  }

  static async getByReference(reference) {
    return SupportModel.getByReference(reference);
  }

  static async create(data) {
    return SupportModel.create(data);
  }

  static async update(reference, data) {
    return SupportModel.update(reference, data);
  }

  static async delete(reference) {
    return SupportModel.delete(reference);
  }

  static async getHistoriqueEtats(reference) {
    return SupportModel.getHistoriqueEtats(reference);
  }
}

module.exports = EmplacementModel;
