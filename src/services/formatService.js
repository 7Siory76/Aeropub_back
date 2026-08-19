const FormatModel = require('../models/formatModel');

class FormatService {
  static async getAll() {
    return await FormatModel.getAll();
  }

  static async getById(id) {
    const format = await FormatModel.getById(id);
    if (!format) {
      const error = new Error(`Format avec l'ID ${id} non trouvé`);
      error.statusCode = 404;
      throw error;
    }
    return format;
  }

  static async create(data) {
    if (!data.ref_format) {
      const error = new Error('Le champ ref_format est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await FormatModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.ref_format) {
      const error = new Error('Le champ ref_format est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await FormatModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await FormatModel.delete(id);
  }
}

module.exports = FormatService;
