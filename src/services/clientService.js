const ClientModel = require('../models/clientModel');

class ClientService {
  static async getAll() {
    return await ClientModel.getAll();
  }

  static async getById(id) {
    const client = await ClientModel.getById(id);
    if (!client) {
      const error = new Error(`Client avec l'ID ${id} non trouvé`);
      error.statusCode = 404;
      throw error;
    }
    return client;
  }

  static async create(data) {
    if (!data.nom_client) {
      const error = new Error('Le champ nom_client est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await ClientModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.nom_client) {
      const error = new Error('Le champ nom_client est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await ClientModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await ClientModel.delete(id);
  }
}

module.exports = ClientService;
