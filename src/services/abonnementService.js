const AbonnementModel = require('../models/abonnementModel');

class AbonnementService {
  static async getAll() {
    return await AbonnementModel.getAll();
  }

  static async getById(id) {
    const abonn = await AbonnementModel.getById(id);
    if (!abonn) {
      const error = new Error(`Abonnement avec l'ID ${id} non trouvé`);
      error.statusCode = 404;
      throw error;
    }
    return abonn;
  }

  static async create(data) {
    if (!data.reference || !data.id_client || !data.date_debut || !data.date_fin) {
      const error = new Error('Les champs reference, id_client, date_debut et date_fin sont obligatoires');
      error.statusCode = 400;
      throw error;
    }
    return await AbonnementModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.reference || !data.id_client || !data.date_debut || !data.date_fin) {
      const error = new Error('Les champs reference, id_client, date_debut et date_fin sont obligatoires');
      error.statusCode = 400;
      throw error;
    }
    return await AbonnementModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await AbonnementModel.delete(id);
  }
}

module.exports = AbonnementService;
