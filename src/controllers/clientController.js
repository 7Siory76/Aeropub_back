const ClientService = require('../services/clientService');
const { sendError } = require('../utils/errorHandler');

class ClientController {
  static async getAll(req, res) {
    try {
      const data = await ClientService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await ClientService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await ClientService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Client créé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async update(req, res) {
    try {
      const data = await ClientService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Client mis à jour avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await ClientService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Client supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = ClientController;
