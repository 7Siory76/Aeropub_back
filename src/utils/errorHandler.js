/**
 * Gestionnaire et normalisateur d'erreurs pour l'API REST AeroPub
 * Traduit les erreurs techniques (PostgreSQL, validations, etc.) en messages clairs et précis pour l'utilisateur.
 */

function sanitizeForLogging(err) {
  if (!err) return err;
  const msg = err.stack || err.message || String(err);
  // Masquer les mots de passe et les chaînes de connexion dans les logs
  return msg
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1*****$3')
    .replace(/(password|passwd|mot_de_passe|secret|token)\s*[:=]\s*['"]?[^'",\s]+['"]?/gi, '$1=*****');
}

function normalizeBackendError(error) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || "Une erreur inattendue est survenue.";

  // 1. Erreur de syntaxe JSON (ex: corps de requête malformé capturé par express.json)
  if (error instanceof SyntaxError && (statusCode === 400 || error.status === 400) && 'body' in error) {
    return {
      statusCode: 400,
      message: "Format JSON de la requête invalide."
    };
  }

  // 2. Erreurs de téléversement Multer
  if (error && error.name === 'MulterError') {
    return {
      statusCode: 400,
      message: `Erreur de téléversement : ${error.message}`
    };
  }

  // 3. Erreurs PostgreSQL avec code standard SQLSTATE
  if (error.code) {
    switch (error.code) {
      case '23505': { // Unique violation
        statusCode = 409;
        const constraint = String(error.constraint || '').toLowerCase();
        const detail = String(error.detail || error.message || '').toLowerCase();

        if (constraint.includes('abonnement') || detail.includes('abonnement') || detail.includes('reference')) {
          message = "La référence de ce contrat (abonnement) existe déjà. Veuillez saisir une référence différente.";
        } else if (constraint.includes('support') || detail.includes('support') || detail.includes('emplacement')) {
          message = "La référence de ce support publicitaire existe déjà. Veuillez saisir une référence unique.";
        } else if (constraint.includes('email') || detail.includes('email')) {
          message = "Cette adresse email est déjà utilisée par un autre compte.";
        } else if (constraint.includes('client') || detail.includes('client') || detail.includes('raison_sociale')) {
          message = "Un client avec ce nom ou cette raison sociale existe déjà.";
        } else if (constraint.includes('zone') || detail.includes('zone')) {
          message = "Cette zone terminale existe déjà.";
        } else if (constraint.includes('type') || detail.includes('type')) {
          message = "Cet intitulé ou type existe déjà.";
        } else {
          message = "Un enregistrement avec cette valeur ou cet identifiant existe déjà (doublon détecté).";
        }
        break;
      }

      case '23503': { // Foreign key violation
        statusCode = 400;
        const detail = String(error.detail || error.message || '').toLowerCase();

        if (detail.includes('is still referenced') || detail.includes('toujours référencé') || detail.includes('table')) {
          message = "Impossible de supprimer ou modifier cet élément : il est actuellement lié à d'autres données (contrats, supports, historiques).";
        } else if (detail.includes('client')) {
          message = "Le client associé est introuvable ou a été supprimé.";
        } else if (detail.includes('commercial') || detail.includes('utilisateur')) {
          message = "L'utilisateur ou commercial assigné est introuvable.";
        } else if (detail.includes('support') || detail.includes('emplacement')) {
          message = "Le support publicitaire sélectionné est introuvable.";
        } else if (detail.includes('zone')) {
          message = "La zone sélectionnée est introuvable.";
        } else if (detail.includes('categorie')) {
          message = "La catégorie spécifiée est introuvable.";
        } else if (detail.includes('statut')) {
          message = "Le type de statut sélectionné est invalide.";
        } else {
          message = "L'opération fait référence à un élément lié qui n'existe plus.";
        }
        break;
      }

      case '23502': { // Not-null violation
        statusCode = 400;
        const col = error.column || 'obligatoire';
        message = `Le champ « ${col} » est obligatoire et doit être renseigné.`;
        break;
      }

      case '22007':
      case '22008': { // Invalid date format
        statusCode = 400;
        message = "La date saisie est invalide ou son format est incorrect.";
        break;
      }

      case '23514': { // Check constraint
        statusCode = 400;
        message = "Les informations fournies ne respectent pas les règles de validation requises.";
        break;
      }

      case '22P02': { // Invalid text representation (ex: string passed to integer)
        statusCode = 400;
        message = "Format de donnée invalide pour l'un des champs transmis.";
        break;
      }

      case 'ECONNREFUSED':
      case '08001':
      case '08006': {
        statusCode = 503;
        message = "Le service de base de données est temporairement indisponible. Veuillez réessayer ultérieurement.";
        break;
      }
    }
  }

  // 4. Détection par libellé texte brut (si le message de la DB est remonté en français ou anglais)
  const lowerMsg = String(message || '').toLowerCase();
  if (
    lowerMsg.includes('contrainte unique') ||
    lowerMsg.includes('unique constraint') ||
    lowerMsg.includes('clé dupliquée') ||
    lowerMsg.includes('duplicate key')
  ) {
    statusCode = 409;
    if (lowerMsg.includes('abonnement')) {
      message = "La référence de ce contrat (abonnement) existe déjà. Veuillez saisir une référence différente.";
    } else if (lowerMsg.includes('support') || lowerMsg.includes('emplacement')) {
      message = "La référence de ce support publicitaire existe déjà.";
    } else if (lowerMsg.includes('email')) {
      message = "Cette adresse email est déjà enregistrée pour un utilisateur.";
    } else {
      message = "Un enregistrement avec cet identifiant existe déjà (doublon détecté).";
    }
  }

  // 5. En production, masquer tout message d'erreur interne (500) pour éviter les fuites d'informations
  const isProduction = process.env.NODE_ENV === 'production';
  if (statusCode >= 500 && isProduction) {
    message = "Une erreur interne est survenue sur le serveur. Veuillez réessayer ultérieurement.";
  }

  return { statusCode, message };
}

function sendError(res, error) {
  const { statusCode, message } = normalizeBackendError(error);
  if (statusCode >= 500) {
    console.error('❌ [API ERROR 500]:', sanitizeForLogging(error));
  }
  return res.status(statusCode).json({
    status: 'error',
    message
  });
}

module.exports = {
  normalizeBackendError,
  sendError,
  sanitizeForLogging
};
