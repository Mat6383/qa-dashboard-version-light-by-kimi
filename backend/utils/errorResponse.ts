import logger from '../services/logger.service';

/**
 * Retourne un objet d'erreur sécurisé pour le client.
 * Loggue le vrai message côté serveur uniquement.
 *
 * @param {Error}  error   - L'erreur originale
 * @param {string} [context] - Contexte (nom de la route) pour les logs
 * @returns {{ success: false, error: string, timestamp: string }}
 */
function safeErrorResponse(error: any, context = 'unknown') {
  logger.error(`[${context}] Erreur interne:`, {
    message: error.message,
    stack: error.stack,
  });

  const isDev = process.env.NODE_ENV !== 'production';
  return {
    success: false,
    error: isDev ? error.message : 'Erreur interne du serveur',
    timestamp: new Date().toISOString(),
  };
}

export { safeErrorResponse };
