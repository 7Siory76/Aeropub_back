const fs = require('fs');
const csv = require('csv-parser');
const ArticleModel = require('../models/articleModel');
const PushService = require('./pushService');

/**
 * SERVICE : Traitement du fichier CSV (Parsing + Sauvegarde BD + Notification)
 * C'est le cœur de la LOGIQUE MÉTIER d'importation CSV.
 */
class CsvService {
  /**
   * Lit et analyse le fichier CSV, l'insère dans PostgreSQL et envoie un Push
   * @param {string} filePath - Chemin vers le fichier CSV temporaire
   */
  static async processCsvFile(filePath) {
    const rawRows = [];

    return new Promise((resolve, reject) => {
      // Lecture du fichier en flux continu (stream) avec csv-parser
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rawRows.push(row);
        })
        .on('end', async () => {
          try {
            console.log(`📄 CSV lu avec succès. ${rawRows.length} lignes trouvées.`);

            // Normalisation des colonnes du CSV (support titre/title, description/content, prix/price, categorie/category)
            const formattedArticles = rawRows.map(row => ({
              title: row.title || row.titre || row.Title || 'Sans titre',
              content: row.content || row.description || row.Content || '',
              price: parseFloat(row.price || row.prix || row.Price || 0),
              category: row.category || row.categorie || row.Category || 'Import CSV'
            }));

            // Insertion en base de données PostgreSQL via le Model
            const savedArticles = await ArticleModel.createMany(formattedArticles);

            // Suppression du fichier temporaire sur le serveur
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }

            // Déclenchement de la notification Push via Firebase
            const notificationTitle = '📦 Nouvel Import CSV Effectué';
            const notificationBody = `${savedArticles.length} article(s) ont été insérés en base de données.`;
            
            await PushService.sendNotificationToTopic(
              'articles_import',
              notificationTitle,
              notificationBody,
              { count: String(savedArticles.length) }
            );

            resolve({
              totalImported: savedArticles.length,
              articles: savedArticles
            });

          } catch (dbOrPushError) {
            // S'assurer de nettoyer le fichier temporaire même en cas d'erreur
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            reject(dbOrPushError);
          }
        })
        .on('error', (streamError) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(streamError);
        });
    });
  }
}

module.exports = CsvService;
