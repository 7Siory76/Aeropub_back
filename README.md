# Serveur API Backend - AeroPub

Serveur API REST moderne développé avec **Node.js**, **Express**, **PostgreSQL** (Neon.tech / local), **Multer**, **csv-parser**, **Nodemailer** et **node-cron**.

Le projet gère l'ensemble du cycle de vie des concessions publicitaires aéroportuaires : gestion des abonnements, des emplacements publicitaires, des clients, des actions commerciales (alertes J-30, préavis, relances), de la facturation et du suivi financier.

Il met en œuvre le pattern d'architecture **Model - Controller - Service (MCS)**.

---

## 🏗️ Architecture du Projet

```
Aeropub_back/
├── .env.example              # Modèle de variables d'environnement
├── .env                      # Variables d'environnement locales
├── package.json              # Dépendances Node.js
├── server.js                 # Point d'entrée de l'application Express
├── uploads/                  # Stockage des fichiers importés et documents liés
└── src/
    ├── config/
    │   ├── db.js             # Connexion PostgreSQL (pg.Pool compatible Neon/Supabase)
    │   ├── initDb.js         # Initialisation du schéma relationnel (base_v3.sql)
    │   ├── multer.js         # Intercepteur de fichier CSV
    │   └── documentMulter.js # Intercepteur de pièces jointes et contrats PDF
    ├── controllers/          # Réception des requêtes HTTP et réponses JSON
    │   ├── abonnementController.js
    │   ├── actionCommercialeController.js
    │   ├── clientController.js
    │   ├── supportController.js
    │   ├── csvController.js
    │   └── ...
    ├── services/             # Logique métier, calculs financiers, règles de gestion
    │   ├── abonnementService.js
    │   ├── actionCommercialeService.js
    │   ├── clientService.js
    │   ├── supportService.js
    │   ├── cronService.js     # Tâches planifiées (échéances, courriels automatiques)
    │   ├── csvService.js      # Import, parsing et détection des conflits contractuels
    │   └── ...
    ├── models/               # Requêtes SQL directes via le client 'pg'
    │   ├── abonnementModel.js
    │   ├── supportModel.js
    │   ├── clientModel.js
    │   └── ...
    └── routes/               # Mappage des endpoints API REST Express
```

---

## 💡 Pattern Model-Controller-Service

| Couche | Rôle & Responsabilité | Exemple dans le projet |
|---|---|---|
| **Route** | Mappe l'URL et le verbe HTTP à une méthode de contrôleur | `router.get('/', AbonnementController.getAll)` |
| **Controller** | Reçoit la requête HTTP, valide les entrées et formate la réponse | `AbonnementController.getAll(req, res)` |
| **Service** | Logique métier (calculs de prorata, vérification de conflits, courriels) | `AbonnementService.getAll()` |
| **Model** | Requêtes SQL paramétrées avec `pg` | `AbonnementModel.getAll()` |

---

## 🚀 Démarrage en Local

### 1. Installation des Dépendances
Dans le dossier `Aeropub_back` :
```bash
npm install
```

### 2. Configuration du fichier `.env`
Dupliquez `.env.example` vers `.env` et adaptez les identifiants :
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://utilisateur:motdepasse@host:5432/aeropub?sslmode=require
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@example.com
SMTP_PASS=votre-mot-de-passe-application
```

### 3. Lancement du Serveur
En mode développement avec rechargement automatique :
```bash
npm run dev
```

En production :
```bash
npm start
```
