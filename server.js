const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./src/config/initDb');
const csvRoutes = require('./src/routes/csvRoutes');
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
const modeleCourrielRoutes = require('./src/routes/modeleCourrielRoutes');
const ZoneController = require('./src/controllers/zoneController');
const { initAbonnementCron } = require('./src/services/cronService');
const { sendError } = require('./src/utils/errorHandler');
const { authMiddleware } = require('./src/middlewares/authMiddleware');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares globaux
app.use(cors()); // Autorise les requêtes Cross-Origin
app.use(express.json()); // Parsing des corps de requêtes JSON
app.use(express.urlencoded({ extended: true }));

// Initialisation automatique à la demande de la base (indispensable pour Vercel / environnements Serverless)
let isDbInitialized = false;
let dbInitPromise = null;
const ensureDbInitialized = async () => {
  if (isDbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        if (process.env.DATABASE_URL) {
          await initDatabase();
          isDbInitialized = true;
          console.log('✅ Base de données PostgreSQL AeroPub initialisée avec succès.');
        }
      } catch (err) {
        console.warn('⚠️ Avertissement initialisation BDD serverless:', err.message);
      } finally {
        dbInitPromise = null;
      }
    })();
  }
  return dbInitPromise;
};

app.use(async (req, res, next) => {
  if (!isDbInitialized && process.env.DATABASE_URL) {
    await ensureDbInitialized();
  }
  next();
});

// Fichiers statiques publics (Pièces jointes et justificatifs)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Définition des Routes API
// 2.1 Route de santé publique (Health check pour Koyeb / monitoring)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Le serveur API Back-Office AeroPub fonctionne correctement 🚀 (Schéma base_v3.sql)',
    timestamp: new Date().toISOString()
  });
});

// 2.2 Routes utilisateurs (Route /login publique, les autres protégées par authMiddleware)
app.use('/api/utilisateurs', utilisateurRoutes);

// 2.3 Routes Métier PROTÉGÉES par Token JWT (Rejette avec 401 si aucun Token valide n'est fourni)
app.use('/api/csv', authMiddleware, csvRoutes);
app.use('/api/zones', authMiddleware, zoneRoutes);
app.get('/api/aeroports', authMiddleware, ZoneController.getAllAeroports);
app.get('/api/perimetres', authMiddleware, ZoneController.getAllPerimetres);
app.use('/api/clients', authMiddleware, clientRoutes);
app.use('/api/localisations', authMiddleware, localisationRoutes);
app.use('/api/categories', authMiddleware, categorieRoutes);
app.use('/api/formats', authMiddleware, formatRoutes);
app.use('/api/typesupports', authMiddleware, typeSupportRoutes);
app.use('/api/supports', authMiddleware, supportRoutes);
app.use('/api/emplacements', authMiddleware, emplacementRoutes); // Alias rétro-compatible
app.use('/api/publicites', authMiddleware, emplacementRoutes); // Alias rétro-compatible
app.use('/api/abonnements', authMiddleware, abonnementRoutes);
app.use('/api/actions-commerciales', authMiddleware, actionCommercialeRoutes);
app.use('/api/documents', authMiddleware, documentRoutes);
app.use('/api/parametrages', authMiddleware, parametrageRoutes);
app.use('/api/types-etats-supports', authMiddleware, typeEtatSupportRoutes);
app.use('/api/types-statuts-abonnements', authMiddleware, typeStatutAbonnementRoutes);
app.use('/api/notifications', authMiddleware, journalRoutes);
app.use('/api/modeles-courriels', authMiddleware, modeleCourrielRoutes);

// 3. Gestionnaire des erreurs 404 (Route non trouvée)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `La route HTTP ${req.method} ${req.originalUrl} n'existe pas.`
  });
});

// 4. Gestionnaire global des erreurs non capturées (JSON malformé, Multer, exceptions middleware)
app.use((err, req, res, next) => {
  sendError(res, err);
});

// 5. Initialisation de la Base de Données et Démarrage du Serveur
const validateRequiredEnv = () => {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key] || !process.env[key].trim());

  if (missing.length > 0) {
    console.error(`❌ ERREUR DE CONFIGURATION : Variable(s) indispensable(s) manquante(s) dans .env : [${missing.join(', ')}].`);
    console.error(`ℹ️ Veuillez renseigner ces variables en vous basant sur le fichier .env.example.`);
    return false;
  }
  return true;
};

const startServer = async () => {
  try {
    const isConfigValid = validateRequiredEnv();
    if (isConfigValid && process.env.DATABASE_URL) {
      try {
        await initDatabase();
        console.log('✅ Tables PostgreSQL AeroPub base_v3.sql initialisées avec succès.');
      } catch (dbInitErr) {
        console.warn('⚠️ Avertissement lors de l\'initialisation des tables:', dbInitErr.message);
      }
    }

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Serveur API Backend démarré sur : http://localhost:${PORT}`);
      console.log(`📡 Route Healthcheck : http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
      initAbonnementCron(); // les requete automaitique
    });
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage du serveur:', error);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, validateRequiredEnv };
