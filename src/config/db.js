const { Pool } = require('pg');
require('dotenv').config();

// Configuration du pool de connexions PostgreSQL
// Fonctionne avec Neon.tech, Supabase ou une instance PostgreSQL classique
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech'))
    ? { rejectUnauthorized: false }
    : false
});

// Événement d'écoute pour la connexion à la base de données
pool.on('connect', () => {
  console.log('⚡ Connecté à la base de données PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur le client PostgreSQL:', err);
});

module.exports = {
  /**
   * Méthode utilitaire pour exécuter une requête SQL paramétrée
   * @param {string} text - La requête SQL (ex: 'SELECT * FROM articles WHERE id = $1')
   * @param {Array} params - Les paramètres pour éviter les injections SQL (ex: [1])
   */
  query: (text, params) => pool.query(text, params),
  pool
};
