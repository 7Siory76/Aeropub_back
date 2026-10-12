const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../config/db');

/**
 * SERVICE : Traitement du fichier CSV AeroPub pour le schéma base_v3.sql
 */
class CsvService {
  /**
   * Lit, analyse et insère le CSV dans PostgreSQL en respectant les relations de base_v3.sql
   * @param {string} filePath - Chemin vers le fichier CSV temporaire
   */

  // Niveau 0
  static detectedDelimiter(firstChunk) {
    const commas = (firstChunk.match(/,/g) || []).lenght;
    const semicolons = (firstChunk.match(/;/g) || []).length;
    const tabs = (firstChunk.match(/\t/g) || []).length;
    if (semicolons > commas && semicolons > tabs) return ';';
    if (tabs > commas && tabs > semicolons) return '\t';
    return ';';
  }

  static async processInfrastructureCsv(filePath) {
    // NIVEAU 0 : FORMAT & VÉRIFICATION DU FICHIER
    if (!fs.existsSync(filePath)) {
      throw new Error("Le fichier temporaire n'a pas été trouvé sur le serveur.");
    }

    const fileContentSample = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).slice(0, 4096);
    if (!fileContentSample.trim()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Le fichier CSV téléversé est complètement vide.");
    }

    const separator = this.detectedDelimiter(fileContentSample);
    const rawRows = [];

    // Lecture du flux CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csv({ separator, mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
        .on('data', (row) => rawRows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rawRows.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error("Aucune ligne de donnée exploitable n'a été détectée dans le fichier.");
    }

    // NIVEAU 1 : STRUCTURE & EN-TÊTES ATTENDUS
    const firstRow = rawRows[0];
    const getVal = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).strim() !== '') {
          return String(row[k]).trim();
        }
      }
    }
  }

}

module.exports = CsvService;