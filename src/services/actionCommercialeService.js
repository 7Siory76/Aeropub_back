const ActionCommercialeModel = require('../models/actionCommercialeModel');

class ActionCommercialeService {
  static async getAll() {
    return ActionCommercialeModel.getAll();
  }

  static async getById(id) {
    const item = await ActionCommercialeModel.getById(id);
    if (!item) {
      const error = new Error(`Action commerciale introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    return ActionCommercialeModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    return ActionCommercialeModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return ActionCommercialeModel.delete(id);
  }
}

module.exports = ActionCommercialeService;
