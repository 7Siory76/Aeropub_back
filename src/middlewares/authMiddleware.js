const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aeropub_super_secret_jwt_key_2026_koyeb_protection!';

/**
 * Middleware d'authentification par Token JWT (Bearer Token)
 * Protège les routes de l'API contre les accès non autorisés.
 * Rejette immédiatement avec HTTP 401 si le token est manquant, invalide ou expiré.
 */
function authMiddleware(req, res, next) {
  // 1. Récupération de l'en-tête Authorization
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader) {
    return res.status(401).json({
      status: 'error',
      code: 'AUTH_TOKEN_MISSING',
      message: "Accès refusé. Aucun jeton d'authentification (Token) fourni."
    });
  }

  // 2. Vérification du format "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      status: 'error',
      code: 'AUTH_TOKEN_MALFORMED',
      message: "Format du jeton d'authentification invalide. Format attendu : 'Bearer <votre_token>'."
    });
  }

  const token = parts[1];

  // 3. Vérification cryptographique et de l'expiration du token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attacher l'utilisateur décodé à la requête pour usage éventuel par les contrôleurs
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        code: 'AUTH_TOKEN_EXPIRED',
        message: "Votre session a expiré. Veuillez vous reconnecter."
      });
    }

    return res.status(401).json({
      status: 'error',
      code: 'AUTH_TOKEN_INVALID',
      message: "Jeton d'authentification invalide ou falsifié."
    });
  }
}

module.exports = {
  authMiddleware,
  JWT_SECRET
};
