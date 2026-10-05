/**
 * Gestionnaire et normalisateur d'erreurs pour l'API REST AeroPub
 * Traduit les erreurs techniques (PostgreSQL, validations, etc.) en messages clairs et précis pour l'utilisateur.
 */

function normalizeBackendError(error) {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Une erreur inattendue est survenue.";

  // 1. Erreurs PostgreSQL avec code standard SQLSTATE
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

      case 'ECONNREFUSED': {
        statusCode = 503;
        message = "Connexion impossible au serveur de base de données PostgreSQL.";
        break;
      }
    }
  }

  // 2. Détection par libellé texte brut (si le message de la DB est remonté en français ou anglais)
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

  return { statusCode, message };
}

function sendError(res, error) {
  const { statusCode, message } = normalizeBackendError(error);
  if (statusCode >= 500) {
    console.error('❌ [API ERROR 500]:', error);
  }
  return res.status(statusCode).json({
    status: 'error',
    message
  });
}

module.exports = {
  normalizeBackendError,
  sendError
};
