const { admin, firebaseInitialized } = require('../config/firebase');

/**
 * SERVICE : Gestion de l'envoi des notifications Push via Firebase Admin SDK
 */
class PushService {
  /**
   * Envoie une notification Push à un sujet (topic) spécifique (ex: 'articles', 'backoffice_updates')
   */
  static async sendNotificationToTopic(topic, title, body, data = {}) {
    if (!firebaseInitialized) {
      console.log(`[SIMULATION PUSH] Topic: '${topic}' | Titre: '${title}' | Message: '${body}'`);
      return { success: true, simulated: true };
    }

    const message = {
      notification: {
        title,
        body
      },
      data,
      topic
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('✅ Push notification envoyée avec succès à Firebase, ID message:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de la notification Push Firebase:', error);
      throw error;
    }
  }

  /**
   * Envoie une notification Push à un token d'appareil spécifique (ex: mobile de l'admin)
   */
  static async sendNotificationToToken(deviceToken, title, body, data = {}) {
    if (!firebaseInitialized) {
      console.log(`[SIMULATION PUSH TOKEN] DeviceToken: '${deviceToken}' | Titre: '${title}'`);
      return { success: true, simulated: true };
    }

    const message = {
      notification: {
        title,
        body
      },
      data,
      token: deviceToken
    };

    try {
      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Erreur d\'envoi au token:', error);
      throw error;
    }
  }
}

module.exports = PushService;
