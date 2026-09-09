const db = require('../config/db');

/**
 * MODEL : Initialisation et gestion du schéma PostgreSQL selon base_v3.sql
 */
class ArticleModel {
  /**
   * Initialise l'ensemble des tables de la base de données aeropub (schéma base_v3.sql)
   */
  static async initTable() {
    const queryText = `
      -- 1. UTILISATEURS & DROITS
      CREATE TABLE IF NOT EXISTS Role (
          id SERIAL PRIMARY KEY,
          nom_role VARCHAR(50) UNIQUE 
      );

      CREATE TABLE IF NOT EXISTS Utilisateur (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(100),
          email VARCHAR(100) UNIQUE,
          mot_de_passe_hash VARCHAR(255),
          id_role INT NOT NULL REFERENCES Role(id),
          actif BOOLEAN DEFAULT TRUE
      );

      -- 2. RÉFÉRENTIELS AÉROPORT & SUPPORTS
      CREATE TABLE IF NOT EXISTS Aeroport (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(50) UNIQUE 
      );

      CREATE TABLE IF NOT EXISTS Perimetre (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(50) UNIQUE 
      );

      CREATE TABLE IF NOT EXISTS Zone_Terminal (
          id SERIAL PRIMARY KEY,
          nom_zone VARCHAR(100), 
          id_aeroport INT NOT NULL REFERENCES Aeroport(id),
          id_perimetre INT NOT NULL REFERENCES Perimetre(id)
      );

      CREATE TABLE IF NOT EXISTS Categorie_Support (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(50) UNIQUE 
      );

      CREATE TABLE IF NOT EXISTS Type_Support (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(50) UNIQUE 
      );

      -- NOUVEAU : Référentiel des états possibles pour un support
      CREATE TABLE IF NOT EXISTS Type_Etat_Support (
          id SERIAL PRIMARY KEY,
          nom_etat VARCHAR(50) UNIQUE
      );

      CREATE TABLE IF NOT EXISTS Support (
          reference VARCHAR(50) PRIMARY KEY, 
          id_zone INT NOT NULL REFERENCES Zone_Terminal(id),
          id_categorie INT NOT NULL REFERENCES Categorie_Support(id),
          id_type INT NOT NULL REFERENCES Type_Support(id),
          caracteristiques TEXT
      );

      -- 3. HISTORIQUE DES ÉTATS DES SUPPORTS
      CREATE TABLE IF NOT EXISTS Etat_Support (
          id SERIAL PRIMARY KEY,
          reference_support VARCHAR(50) NOT NULL REFERENCES Support(reference) ON DELETE CASCADE,
          id_type_etat INT NOT NULL REFERENCES Type_Etat_Support(id), 
          date_debut TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          date_fin TIMESTAMP, 
          id_utilisateur INT REFERENCES Utilisateur(id), 
          observation TEXT
      );

      -- 4. CLIENTS & CONTACTS
      CREATE TABLE IF NOT EXISTS Client (
          id SERIAL PRIMARY KEY,
          raison_sociale VARCHAR(150) NOT NULL,
          adresse_postale TEXT,
          adresse_facturation TEXT,
          etat_client VARCHAR(50) DEFAULT 'Actif', 
          date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Contact (
          id SERIAL PRIMARY KEY,
          id_client INT NOT NULL REFERENCES Client(id) ON DELETE CASCADE,
          nom_contact VARCHAR(100),
          valeur VARCHAR(100),
          est_principal BOOLEAN DEFAULT FALSE
      );

      -- 5. ABONNEMENTS
      -- NOUVEAU : Référentiel des statuts possibles pour un abonnement
      CREATE TABLE IF NOT EXISTS Type_Statut_Abonnement (
          id SERIAL PRIMARY KEY,
          nom_statut VARCHAR(50) UNIQUE
      );

      CREATE TABLE IF NOT EXISTS Abonnement (
          reference VARCHAR(50) PRIMARY KEY,
          id_client INT NOT NULL REFERENCES Client(id) ON DELETE CASCADE,
          id_commercial INT NOT NULL REFERENCES Utilisateur(id),
          id_abonnement_precedent VARCHAR(50) REFERENCES Abonnement(reference),
          annonceur_campagne VARCHAR(150),
          tarif NUMERIC(15, 2) NOT NULL,
          devise VARCHAR(10) DEFAULT 'MGA',
          periodicite VARCHAR(50), 
          date_debut TIMESTAMP NOT NULL,
          date_echeance TIMESTAMP NOT NULL,
          reconduction_tacite BOOLEAN DEFAULT FALSE,
          preavis_jours INT DEFAULT 30,
          probabilite_renouvellement INT, 
          motif_non_renouvellement TEXT,
          date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Abonnement_Support (
          id_abonnement VARCHAR(50) NOT NULL REFERENCES Abonnement(reference) ON DELETE CASCADE,
          reference_support VARCHAR(50) NOT NULL REFERENCES Support(reference) ON DELETE CASCADE,
          PRIMARY KEY (id_abonnement, reference_support)
      );

      -- 6. HISTORIQUE DES STATUTS DES ABONNEMENTS
      CREATE TABLE IF NOT EXISTS Statut_Abonnement (
          id SERIAL PRIMARY KEY,
          id_abonnement VARCHAR(50) NOT NULL REFERENCES Abonnement(reference) ON DELETE CASCADE,
          id_type_statut INT NOT NULL REFERENCES Type_Statut_Abonnement(id),
          date_debut TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          date_fin TIMESTAMP, 
          id_utilisateur INT REFERENCES Utilisateur(id),
          commentaire TEXT
      );

      -- 7. SUIVI DES ACTIONS ET ALERTES J-30
      CREATE TABLE IF NOT EXISTS Action_Commerciale (
          id SERIAL PRIMARY KEY,
          id_abonnement VARCHAR(50) REFERENCES Abonnement(reference) ON DELETE SET NULL,
          id_client INT REFERENCES Client(id) ON DELETE SET NULL,
          id_utilisateur INT NOT NULL REFERENCES Utilisateur(id),
          type_action VARCHAR(50), 
          date_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          description TEXT,
          statut_envoi_email VARCHAR(50)
      );

      -- 8. PIÈCES JOINTES ET DOCUMENTS
      CREATE TABLE IF NOT EXISTS Document_Lie (
          id SERIAL PRIMARY KEY,
          id_abonnement VARCHAR(50) REFERENCES Abonnement(reference) ON DELETE SET NULL,
          id_client INT REFERENCES Client(id) ON DELETE SET NULL,
          reference_support VARCHAR(50) REFERENCES Support(reference) ON DELETE SET NULL,
          nom_fichier VARCHAR(255) NOT NULL,
          url_chemin VARCHAR(500) NOT NULL,
          type_document VARCHAR(50), 
          date_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 9. PARAMÉTRAGE
      CREATE TABLE IF NOT EXISTS Parametrage (
         id SERIAL PRIMARY KEY,
         nom_parametre VARCHAR(100) NOT NULL UNIQUE,
         valeur VARCHAR(255) NOT NULL
      );

      -- Insertion des valeurs fixes de statuts uniquement si la table est vide
      INSERT INTO Type_Statut_Abonnement (nom_statut)
      SELECT s.nom FROM (VALUES 
        ('brouillon'), ('à valider'), ('actif'), ('bientôt échu'), ('renouvelé'), ('expiré'), ('résilié'), ('archivé')
      ) AS s(nom)
      WHERE NOT EXISTS (SELECT 1 FROM Type_Statut_Abonnement LIMIT 1);

      -- Insertion des valeurs fixes d'états uniquement si la table est vide
      INSERT INTO Type_Etat_Support (nom_etat)
      SELECT e.nom FROM (VALUES 
        ('disponible'), ('réservé'), ('occupé'), ('en maintenance'), ('indisponible'), ('archivé')
      ) AS e(nom)
      WHERE NOT EXISTS (SELECT 1 FROM Type_Etat_Support LIMIT 1);

      -- Synchronisation des séquences pour éviter tout conflit de clé primaire
      SELECT setval(pg_get_serial_sequence('type_statut_abonnement', 'id'), COALESCE((SELECT MAX(id) FROM type_statut_abonnement), 1));
      SELECT setval(pg_get_serial_sequence('type_etat_support', 'id'), COALESCE((SELECT MAX(id) FROM type_etat_support), 1));

      -- Table articles pour le module legacy si nécessaire
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

  static async getAll() {
    const { rows } = await db.query('SELECT * FROM articles ORDER BY created_at DESC');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM articles WHERE id = $1', [id]);
    return rows[0];
  }

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

  static async delete(id) {
    const { rows } = await db.query('DELETE FROM articles WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
}

module.exports = ArticleModel;
