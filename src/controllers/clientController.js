const ClientService = require('../services/clientService');
const { sendError } = require('../utils/errorHandler');

class ClientController {
  static async getAll(req, res) {
    try {
      const listeClients = await ClientService.getAll();
      return res.status(200).json({ status: 'success', count: listeClients.length, data: listeClients });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const client = await ClientService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: client });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const nouveauClient = await ClientService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Client créé avec succès', data: nouveauClient });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const clientMisAJour = await ClientService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Client mis à jour avec succès', data: clientMisAJour });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const clientSupprime = await ClientService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Client supprimé avec succès', data: clientSupprime });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getContacts(req, res) {
    try {
      const contacts = await ClientService.getContacts(req.params.id);
      return res.status(200).json({ status: 'success', count: contacts.length, data: contacts });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = ClientController;
