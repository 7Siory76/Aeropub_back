const ZoneModel = require('../models/zoneModel');

class ZoneService {
  static async getAll() {
    return await ZoneModel.getAll();
  }

  static async getById(id) {
    const zone = await ZoneModel.getById(id);
    if (!zone) {
      const error = new Error(`Zone avec l'ID ${id} non trouvée`);
      error.statusCode = 404;
      throw error;
    }
    return zone;
  }

  static async create(data) {
    if (!data.type_zone) {
      const error = new Error('Le champ type_zone est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await ZoneModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.type_zone) {
      const error = new Error('Le champ type_zone est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await ZoneModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await ZoneModel.delete(id);
  }
}

module.exports = ZoneService;
