const ClientModel = require('../models/clientModel');

class ClientService {
  static async getAll() {
    return ClientModel.getAll();
  }

  static async getById(id) {
    const item = await ClientModel.getById(id);
    if (!item) {
      const error = new Error(`Client introuvable avec l'identifiant ${id}.`);
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  static async create(data) {
    if (!data.raison_sociale && !data.nom_client) {
      const error = new Error('La raison sociale ou le nom du client est obligatoire.');
      error.statusCode = 400;
      throw error;
    }
    return ClientModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    return ClientModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return ClientModel.delete(id);
  }

  static async getContacts(id) {
    return ClientModel.getContacts(id);
  }
}

module.exports = ClientService;
