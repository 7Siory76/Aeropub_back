const CategorieModel = require('../models/categorieModel');

class CategorieService {
  static async getAll() {
    return await CategorieModel.getAll();
  }

  static async getById(id) {
    const cat = await CategorieModel.getById(id);
    if (!cat) {
      const error = new Error(`Catégorie avec l'ID ${id} non trouvée`);
      error.statusCode = 404;
      throw error;
    }
    return cat;
  }

  static async create(data) {
    if (!data.nom_categorie) {
      const error = new Error('Le champ nom_categorie est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await CategorieModel.create(data);
  }

  static async update(id, data) {
    await this.getById(id);
    if (!data.nom_categorie) {
      const error = new Error('Le champ nom_categorie est obligatoire');
      error.statusCode = 400;
      throw error;
    }
    return await CategorieModel.update(id, data);
  }

  static async delete(id) {
    await this.getById(id);
    return await CategorieModel.delete(id);
  }
}

module.exports = CategorieService;
