# Serveur API Backend - BACK_OFFICE

Ce projet est un serveur API REST moderne développé avec **Node.js**, **Express**, **PostgreSQL** (Neon.tech / Supabase), **Multer**, **csv-parser** et **Firebase Admin SDK**.

Il met en œuvre le pattern d'architecture **Model - Controller - Service (MCS)**.

---

## 🏗️ Architecture du Projet

```
BACK_OFFICE/
├── .env.example              # Modèle de variables d'environnement
├── .env                      # Variables d'environnement locales
├── .gitignore                # Fichiers ignorés par Git
├── package.json              # Dépendances Node.js
├── server.js                 # Point d'entrée de l'application Express
├── uploads/                  # Stockage temporaire des fichiers CSV reçus par Multer
└── src/
    ├── config/
    │   ├── db.js             # Connexion PostgreSQL (pg.Pool compatible Neon/Supabase)
    │   ├── firebase.js       # Initialisation du SDK Firebase Admin
    │   └── multer.js         # Intercepteur de fichier CSV (upload)
    ├── controllers/
    │   ├── csvController.js  # Reçoit la requête HTTP POST /api/csv/upload
    │   └── articleController.js # Gère les réponses HTTP pour les articles
    ├── services/
    │   ├── csvService.js     # Flux de lecture csv-parser, sauvegarde DB & déclenchement Push
    │   ├── pushService.js    # Envoi de notifications Push Firebase (FCM)
    │   └── articleService.js # Traitement et règles métier des articles
    ├── models/
    │   └── articleModel.js   # Requêtes SQL directes via le client 'pg'
    └── routes/
        ├── csvRoutes.js      # Définition de la route d'importation CSV
        └── articleRoutes.js  # Définition des routes CRUD articles
```

---

## 💡 Comprendre le Pattern Model-Controller-Service

| Couche | Rôle & Responsabilité | Exemple dans le projet |
|---|---|---|
| **Route** | Mappe l'URL et la méthode HTTP à un contrôleur | `router.post('/upload', upload.single('file'), CsvController.uploadCsv)` |
| **Controller** | Reçoit `req`, extrait le fichier/données, renvoie `res.status(200).json(...)` | `CsvController.uploadCsv(req, res)` |
| **Service** | Logique Métier (lecture `csv-parser`, déclenchement push Firebase) | `CsvService.processCsvFile(filePath)` |
| **Model** | Requêtes SQL brutes avec `pg` | `ArticleModel.createMany(articlesData)` |

---

## 🚀 Démarrage en Local

### 1. Installation des Dépendances
Dans le dossier `BACK_OFFICE`, exécutez :
```bash
npm install
```

### 2. Configuration du fichier `.env`
Dupliquez `.env.example` vers `.env` et adaptez les identifiants :
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://utilisateur:motdepasse@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
FIREBASE_PROJECT_ID=votre-projet
FIREBASE_CLIENT_EMAIL=votre-service-account@iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 3. Lancement du Serveur
En mode développement avec rechargement automatique (`nodemon`) :
```bash
npm run dev
```

---

## 🌐 Déploiement (Render ou Koyeb)

### Déploiement sur Render
1. Créez un nouveau **Web Service** sur [Render.com](https://render.com).
2. Connectez le dépôt Git et sélectionnez le dossier racine `BACK_OFFICE`.
3. Configurez les commandes :
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
4. Ajoutez les **Environment Variables** dans l'interface de Render (`DATABASE_URL`, `FIREBASE_PROJECT_ID`, etc.).

### Déploiement sur Koyeb
1. Créez une nouvelle application sur [Koyeb.com](https://koyeb.com).
2. Choisissez la méthode **GitHub**.
3. Spécifiez `npm install` et `node server.js`.
4. Ajoutez vos variables d'environnement dans l'onglet **Environment Variables**.
