const express = require('express');
const cors = require('cors');
require('dotenv').config();

const ArticleModel = require('./src/models/articleModel');
const csvRoutes = require('./src/routes/csvRoutes');
const articleRoutes = require('./src/routes/articleRoutes');
const zoneRoutes = require('./src/routes/zoneRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const localisationRoutes = require('./src/routes/localisationRoutes');
const categorieRoutes = require('./src/routes/categorieRoutes');
const formatRoutes = require('./src/routes/formatRoutes');
const typeSupportRoutes = require('./src/routes/typeSupportRoutes');
const supportRoutes = require('./src/routes/supportRoutes');
const emplacementRoutes = require('./src/routes/emplacementRoutes');
const abonnementRoutes = require('./src/routes/abonnementRoutes');
const utilisateurRoutes = require('./src/routes/utilisateurRoutes');
const actionCommercialeRoutes = require('./src/routes/actionCommercialeRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const parametrageRoutes = require('./src/routes/parametrageRoutes');
const typeEtatSupportRoutes = require('./src/routes/typeEtatSupportRoutes');
const typeStatutAbonnementRoutes = require('./src/routes/typeStatutAbonnementRoutes');
const journalRoutes = require('./src/routes/journalNotificationRoutes');
const ZoneController = require('./src/controllers/zoneController');


const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares globaux
app.use(cors()); // Autorise les requêtes Cross-Origin
app.use(express.json()); // Parsing des corps de requêtes JSON
app.use(express.urlencoded({ extended: true }));

// 2. Définition des Routes API
app.use('/api/csv', csvRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/zones', zoneRoutes);
app.get('/api/aeroports', ZoneController.getAllAeroports);
app.get('/api/perimetres', ZoneController.getAllPerimetres);
app.use('/api/clients', clientRoutes);
app.use('/api/localisations', localisationRoutes);
app.use('/api/categories', categorieRoutes);
app.use('/api/formats', formatRoutes);
app.use('/api/typesupports', typeSupportRoutes);
app.use('/api/supports', supportRoutes);
app.use('/api/emplacements', emplacementRoutes); // Alias rétro-compatible
app.use('/api/publicites', emplacementRoutes); // Alias rétro-compatible
app.use('/api/abonnements', abonnementRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);
app.use('/api/actions-commerciales', actionCommercialeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/parametrages', parametrageRoutes);
app.use('/api/types-etats-supports', typeEtatSupportRoutes);
app.use('/api/types-statuts-abonnements', typeStatutAbonnementRoutes);
app.use('/api/notifications', journalRoutes);

// Route de santé (Health check)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Le serveur API Back-Office AeroPub fonctionne correctement 🚀 (Schéma base_v3.sql)',
    timestamp: new Date().toISOString()
  });
});

// 3. Gestionnaire des erreurs 404 (Route non trouvée)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `La route HTTP ${req.method} ${req.originalUrl} n'existe pas.`
  });
});

// 4. Initialisation de la Base de Données et Démarrage du Serveur
const startServer = async () => {
  try {
    if (process.env.DATABASE_URL) {
      try {
        await ArticleModel.initTable();
        console.log('✅ Tables PostgreSQL AeroPub base_v3.sql initialisées avec succès.');
      } catch (dbInitErr) {
        console.warn('⚠️ Avertissement lors de l\'initialisation des tables:', dbInitErr.message);
      }
    } else {
      console.warn('⚠️ DATABASE_URL manquant dans le fichier .env.');
    }

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Serveur API Backend démarré sur : http://localhost:${PORT}`);
      console.log(`📡 Route Healthcheck : http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage du serveur:', error);
  }
};

startServer();
