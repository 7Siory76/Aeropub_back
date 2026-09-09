const ZoneModel = require('../models/zoneModel');

class ZoneService {
  static async getAll() {
    return ZoneModel.getAll();
  }

  static async getById(id) {
    const item = await ZoneModel.getById(id);
    if (!item) {
      const error = new Error(`Zone introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    return ZoneModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    return ZoneModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return ZoneModel.delete(id);
  }

  static async getAllAeroports() {
    return ZoneModel.getAllAeroports();
  }

  static async getAllPerimetres() {
    return ZoneModel.getAllPerimetres();
  }
}

module.exports = ZoneService;
