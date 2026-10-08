const DocumentService = require('../services/documentService');
const { sendError } = require('../utils/errorHandler');

class DocumentController {
  static async getAll(req, res) {
    try {
      const data = await DocumentService.getAll();
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getById(req, res) {
    try {
      const data = await DocumentService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async getByAbonnement(req, res) {
    try {
      const data = await DocumentService.getByAbonnement(req.params.reference);
      return res.status(200).json({ status: 'success', count: data.length, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  // Upload d'un fichier via Multer
  static async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'Aucun fichier fourni.' });
      }

      const { id_abonnement, reference_support, type_document } = req.body;
      if (!id_abonnement) {
        return res.status(400).json({ status: 'error', message: "L'identifiant du contrat (id_abonnement) est obligatoire." });
      }

      const url_chemin = `/uploads/documents/${req.file.filename}`;
      const data = await DocumentService.create({
        id_abonnement,
        reference_support: reference_support || null,
        nom_fichier: req.file.originalname,
        url_chemin,
        type_document: type_document || 'Contrat'
      });

      return res.status(201).json({ status: 'success', message: 'Document uploadé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async create(req, res) {
    try {
      const data = await DocumentService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Document enregistré avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  static async delete(req, res) {
    try {
      const data = await DocumentService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Document supprimé avec succès', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
}

module.exports = DocumentController;
