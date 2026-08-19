const EmplacementService = require('./emplacementService');

class PubliciteService {
  static async getAll() {
    return await EmplacementService.getAll();
  }

  static async getByReference(ref) {
    return await EmplacementService.getByReference(ref);
  }

  static async create(data) {
    return await EmplacementService.create(data);
  }

  static async update(ref, data) {
    return await EmplacementService.update(ref, data);
  }

  static async delete(ref) {
    return await EmplacementService.delete(ref);
  }
}

module.exports = PubliciteService;
