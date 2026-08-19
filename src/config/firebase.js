const admin = require('firebase-admin');
require('dotenv').config();

let firebaseInitialized = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    firebaseInitialized = true;
    console.log('🔥 SDK Firebase Admin initialisé avec succès.');
  } else {
    console.warn('⚠️ Identifiants Firebase non fournis dans .env. Les notifications Push seront simulées en log.');
  }
} catch (error) {
  console.error('❌ Erreur lors de l\'initialisation de Firebase Admin:', error.message);
}

module.exports = {
  admin,
  firebaseInitialized
};
