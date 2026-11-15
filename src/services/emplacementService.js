const SupportService = require('./supportService');

/**
 * EmplacementService : Alias rétro-compatible pointant vers SupportService
 */
class EmplacementService {
  static async getAll() {
    return SupportService.getAll();
  }

  static async getByReference(reference) {
    return SupportService.getByReference(reference);
  }

  static async create(data) {
    return SupportService.create(data);
  }

  static async update(reference, data) {
    return SupportService.update(reference, data);
  }

  static async delete(reference) {
    return SupportService.delete(reference);
  }

  static async getHistoriqueEtats(reference) {
    return SupportService.getHistoriqueEtats(reference);
  }
}

module.exports = EmplacementService;
