const db = require('./db');
const bcrypt = require('bcryptjs');

/**
 * Initialise l'ensemble des tables PostgreSQL de la base de données AeroPub (schéma base_v3.sql)
 */
async function initDatabase() {
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

    CREATE TABLE IF NOT EXISTS Format (
        id SERIAL PRIMARY KEY,
        ref_format VARCHAR(100) UNIQUE NOT NULL
    );

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
        id_commercial INT REFERENCES Utilisateur(id),
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

    -- 7. SUIVI DES ACTIONS ET ALERTES
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
        id_abonnement VARCHAR(50) REFERENCES Abonnement(reference) ON DELETE CASCADE,
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

    -- 10. MODÈLES DE COURRIELS
    CREATE TABLE IF NOT EXISTS Modele_Courriel (
       id SERIAL PRIMARY KEY,
       code_modele VARCHAR(50) NOT NULL UNIQUE,
       titre VARCHAR(100) NOT NULL,
       sujet VARCHAR(255) NOT NULL,
       corps TEXT NOT NULL,
       variables_disponibles TEXT,
       date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Insertion des rôles fondamentaux avec identifiants explicites s'ils n'existent pas
    INSERT INTO Role (id, nom_role)
    SELECT r.id, r.nom FROM (VALUES 
      (1, 'Administrateur'), 
      (2, 'Commercial'), 
      (3, 'Direction'), 
      (4, 'Resp_Com'), 
      (5, 'Lecture_Seule')
    ) AS r(id, nom)
    WHERE NOT EXISTS (
      SELECT 1 FROM Role existing WHERE existing.id = r.id OR existing.nom_role = r.nom
    );

    -- Insertion des valeurs fixes de statuts avec identifiants explicites s'ils n'existent pas
    INSERT INTO Type_Statut_Abonnement (id, nom_statut)
    SELECT s.id, s.nom FROM (VALUES 
      (1, 'brouillon'), 
      (2, 'à valider'), 
      (3, 'actif'), 
      (4, 'bientot échu'), 
      (5, 'renouvelé'), 
      (6, 'expiré'), 
      (7, 'résilié'), 
      (8, 'archivé')
    ) AS s(id, nom)
    WHERE NOT EXISTS (
      SELECT 1 FROM Type_Statut_Abonnement existing WHERE existing.id = s.id OR existing.nom_statut = s.nom
    );

    -- Insertion des valeurs fixes d'états de support avec identifiants explicites s'ils n'existent pas
    INSERT INTO Type_Etat_Support (id, nom_etat)
    SELECT e.id, e.nom FROM (VALUES 
      (1, 'disponible'), 
      (2, 'réservé'), 
      (3, 'occupé'), 
      (4, 'en maintenance'), 
      (5, 'indisponible'), 
      (6, 'archivé')
    ) AS e(id, nom)
    WHERE NOT EXISTS (
      SELECT 1 FROM Type_Etat_Support existing WHERE existing.id = e.id OR existing.nom_etat = e.nom
    );

    -- Insertion des paramètres indispensables s'ils n'existent pas
    INSERT INTO Parametrage (nom_parametre, valeur)
    VALUES 
      ('DELAI_ALERTE_J_MOINS', '30'),
      ('Heure_serveur', '08:00'),
      ('Mail_sender', ''),
      ('mail_password', '')
    ON CONFLICT (nom_parametre) DO NOTHING;

    -- Synchronisation des séquences pour éviter tout conflit de clé primaire
    SELECT setval(pg_get_serial_sequence('role', 'id'), COALESCE((SELECT MAX(id) FROM Role), 1));
    SELECT setval(pg_get_serial_sequence('type_statut_abonnement', 'id'), COALESCE((SELECT MAX(id) FROM Type_Statut_Abonnement), 1));
    SELECT setval(pg_get_serial_sequence('type_etat_support', 'id'), COALESCE((SELECT MAX(id) FROM Type_Etat_Support), 1));
    SELECT setval(pg_get_serial_sequence('parametrage', 'id'), COALESCE((SELECT MAX(id) FROM Parametrage), 1));
  `;

  const result = await db.query(queryText);

  // Création des index d'optimisation pour requêtes volumineuses (> 50 000 lignes)
  const performanceIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_abonnement_client ON Abonnement(id_client)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_commercial ON Abonnement(id_commercial)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_echeance ON Abonnement(date_echeance)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_debut ON Abonnement(date_debut)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_precedent ON Abonnement(id_abonnement_precedent)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_creation ON Abonnement(date_creation DESC)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_support_abo ON Abonnement_Support(id_abonnement)',
    'CREATE INDEX IF NOT EXISTS idx_abonnement_support_sup ON Abonnement_Support(reference_support)',
    'CREATE INDEX IF NOT EXISTS idx_statut_abo_lookup ON Statut_Abonnement(id_abonnement, id DESC)',
    'CREATE INDEX IF NOT EXISTS idx_statut_abo_dates ON Statut_Abonnement(id_abonnement, date_debut, date_fin)',
    'CREATE INDEX IF NOT EXISTS idx_etat_support_lookup ON Etat_Support(reference_support, id DESC)',
    'CREATE INDEX IF NOT EXISTS idx_etat_support_dates ON Etat_Support(reference_support, date_debut, date_fin)',
    'CREATE INDEX IF NOT EXISTS idx_support_zone ON Support(id_zone)',
    'CREATE INDEX IF NOT EXISTS idx_support_categorie ON Support(id_categorie)',
    'CREATE INDEX IF NOT EXISTS idx_support_type ON Support(id_type)',
    'CREATE INDEX IF NOT EXISTS idx_contact_client ON Contact(id_client, est_principal DESC, id ASC)',
    'CREATE INDEX IF NOT EXISTS idx_client_rs ON Client(raison_sociale)',
    'CREATE INDEX IF NOT EXISTS idx_document_abo ON Document_Lie(id_abonnement)',
    'CREATE INDEX IF NOT EXISTS idx_action_comm_abo ON Action_Commerciale(id_abonnement)',
    'CREATE INDEX IF NOT EXISTS idx_action_comm_client ON Action_Commerciale(id_client)',
    'CREATE INDEX IF NOT EXISTS idx_action_comm_date ON Action_Commerciale(date_action DESC)',
    'CREATE INDEX IF NOT EXISTS idx_journal_notif_date ON Journal_Notification(date_action DESC)',
    'CREATE INDEX IF NOT EXISTS idx_journal_notif_lu ON Journal_Notification(lu_par_admin) WHERE lu_par_admin = FALSE'
  ];

  for (const idxQuery of performanceIndexes) {
    try {
      await db.query(idxQuery);
    } catch {
      // Ignorer si l'utilisateur DB actuel n'a pas les droits de modification de schéma
    }
  }

  // Initialisation de l'administrateur par défaut si aucun utilisateur n'existe en base
  try {
    const userCheck = await db.query('SELECT id FROM Utilisateur LIMIT 1');
    if (userCheck.rows.length === 0) {
      const roleAdminRes = await db.query(
        "SELECT id FROM Role WHERE LOWER(nom_role) = 'administrateur' ORDER BY id ASC LIMIT 1"
      );
      const idRoleAdmin = roleAdminRes.rows[0]?.id || 1;
      const defaultPasswordHash = await bcrypt.hash('admin123', 10);

      await db.query(`
        INSERT INTO Utilisateur (nom, email, mot_de_passe_hash, id_role, actif)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (email) DO NOTHING
      `, ['Admin Principal', 'admin@aeropub.mg', defaultPasswordHash, idRoleAdmin]);

      console.log('👤 Compte Administrateur par défaut initialisé (admin@aeropub.mg / admin123).');
    }
    await db.query("SELECT setval(pg_get_serial_sequence('utilisateur', 'id'), COALESCE((SELECT MAX(id) FROM Utilisateur), 1));");
  } catch (userInitErr) {
    console.warn('⚠️ Avertissement initialisation administrateur par défaut :', userInitErr.message);
  }

  try {
    await db.query('ALTER TABLE Abonnement DROP COLUMN IF EXISTS probabilite_renouvellement;');
  } catch {
    // Ignorer si l'utilisateur DB n'est pas propriétaire de la table
  }
  return result;
}

module.exports = { initDatabase };
