const AbonnementModel = require('../models/abonnementModel');

class AbonnementService {
  static async getAll(filters) {
    return AbonnementModel.getAll(filters);
  }

  static async getById(id) {
    const abonnement = await AbonnementModel.getById(id);
    if (!abonnement) {
      const error = new Error(`Abonnement introuvable avec la référence "${id}".`);
      error.statusCode = 404;
      throw error;
    }
    return abonnement;
  }

  static async create(data) {
    return AbonnementModel.create(data);
  }

  static async update(id, data) {
    return AbonnementModel.update(id, data);
  }

  static async delete(id) {
    return AbonnementModel.delete(id);
  }

  static async getSupportsByAbonnement(id) {
    return AbonnementModel.getSupportsByAbonnement(id);
  }

  static async getHistoriqueStatuts(id) {
    await this.getById(id);
    return AbonnementModel.getHistoriqueStatuts(id);
  }
}

module.exports = AbonnementService;
