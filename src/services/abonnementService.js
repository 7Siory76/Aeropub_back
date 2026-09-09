const AbonnementModel = require('../models/abonnementModel');

class AbonnementService {
  static async getAll() {
    return AbonnementModel.getAll();
  }

  static async getById(id) {
    const item = await AbonnementModel.getById(id);
    if (!item) {
      const error = new Error(`Abonnement introuvable avec la référence "${id}".`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.id_client) {
      const error = new Error('Le client (id_client) est requis pour créer un abonnement.');
      error.statusCode = 400;
      throw error;
    }
    return AbonnementModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    return AbonnementModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return AbonnementModel.delete(id);
  }

  static async getSupportsByAbonnement(id) {
    return AbonnementModel.getSupportsByAbonnement(id);
  }
}

module.exports = AbonnementService;
