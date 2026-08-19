const TypeSupportModel = require('../models/typeSupportModel');

class TypeSupportService {
  static async getAll() {
    return await TypeSupportModel.getAll();
  }

  static async getById(id) {
    const item = await TypeSupportModel.getById(id);
    if (!item) {
      const error = new Error(`TypeSupport avec l'ID ${id} non trouvé`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.nom_type) {
      const error = new Error('Le champ nom_type est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await TypeSupportModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.nom_type) {
      const error = new Error('Le champ nom_type est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await TypeSupportModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await TypeSupportModel.delete(id);
  }
}

module.exports = TypeSupportService;
