const db = require('../config/db');

/**
 * MODEL : Responsable des accès directs à la Base de Données PostgreSQL
 * Ne contient PAS de logique HTTP ni de logique métier complexe.
 */
class ArticleModel {
  /**
   * Initialise le schéma des tables de la base de données aeropub
   */
  static async initTable() {
    const queryText = `
      CREATE TABLE IF NOT EXISTS Zone (
         id SERIAL PRIMARY KEY,
         type_zone VARCHAR(50) UNIQUE
      );

      CREATE TABLE IF NOT EXISTS Client (
         id SERIAL PRIMARY KEY,
         nom_client VARCHAR(50),
         contact VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS Localisation (
         id SERIAL PRIMARY KEY,
         nom_lieu VARCHAR(50),
         id_zone INT NOT NULL,
         FOREIGN KEY(id_zone) REFERENCES Zone(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Categorie (
         id SERIAL PRIMARY KEY,
         nom_categorie VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS Format (
         id SERIAL PRIMARY KEY,
         ref_format VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS Publicite (
         reference VARCHAR(50) PRIMARY KEY,
         id_format INT NOT NULL,
         id_categorie INT NOT NULL,
         id_localisation INT NOT NULL,
         FOREIGN KEY(id_format) REFERENCES Format(id) ON DELETE CASCADE,
         FOREIGN KEY(id_categorie) REFERENCES Categorie(id) ON DELETE CASCADE,
         FOREIGN KEY(id_localisation) REFERENCES Localisation(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Abonnement (
         id SERIAL PRIMARY KEY,
         date_debut TIMESTAMP,
         date_fin TIMESTAMP,
         reference VARCHAR(50) NOT NULL,
         id_client INT NOT NULL,
         FOREIGN KEY(reference) REFERENCES Publicite(reference) ON DELETE CASCADE,
         FOREIGN KEY(id_client) REFERENCES Client(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        price NUMERIC(10, 2) DEFAULT 0,
        category VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return db.query(queryText);
  }

  /**
   * Insère un article dans la base de données
   */
  static async create({ title, content, price, category }) {
    const queryText = `
      INSERT INTO articles (title, content, price, category, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `;
    const values = [title, content || '', price || 0, category || 'Général'];
    const { rows } = await db.query(queryText, values);
    return rows[0];
  }

  /**
   * Insertion par lot (Bulk insert) pour optimiser l'importation CSV
   */
  static async createMany(articles) {
    if (!articles || articles.length === 0) return [];

    const insertedArticles = [];
    for (const item of articles) {
      const inserted = await this.create(item);
      insertedArticles.push(inserted);
    }
    return insertedArticles;
  }

  /**
   * Récupère tous les articles
   */
  static async getAll() {
    const queryText = 'SELECT * FROM articles ORDER BY created_at DESC';
    const { rows } = await db.query(queryText);
    return rows;
  }

  /**
   * Récupère un article par son ID
   */
  static async getById(id) {
    const queryText = 'SELECT * FROM articles WHERE id = $1';
    const { rows } = await db.query(queryText, [id]);
    return rows[0];
  }

  /**
   * Supprime un article par son ID
   */
  static async delete(id) {
    const queryText = 'DELETE FROM articles WHERE id = $1 RETURNING *';
    const { rows } = await db.query(queryText, [id]);
    return rows[0];
  }
}

module.exports = ArticleModel;
