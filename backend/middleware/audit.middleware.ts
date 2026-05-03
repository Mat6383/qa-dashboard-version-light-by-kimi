import auditService from '../services/audit.service';

/**
 * Crée un middleware d'audit pour une action donnée.
 * @param {string} action - Identifiant de l'action (ex: 'sync.execute')
 * @param {Object} options
 * @param {boolean} options.captureBody - Inclure le body de la requête dans details (défaut: false)
 * @param {boolean} options.captureParams - Inclure req.params dans details (défaut: false)
 */
function auditAction(action: any, options: any = {}) {
  const { captureBody = false, captureParams = false } = options;

  return (req: any, res: any, next: any) => {
    res.on('finish', () => {
      const user = req.user || null;
      const details: any = {};

      if (captureParams && req.params) {
        details.params = req.params;
      }
      if (captureBody && req.body) {
        details.body = req.body;
      }

      auditService.log({
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
        actorRole: user?.role ?? null,
        action,
        resource: action.split('.')[0] || null,
        resourceId: captureParams ? req.params?.key || req.params?.id || null : null,
        method: req.method,
        path: req.originalUrl || req.path,
        ip: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
        statusCode: res.statusCode,
        details: Object.keys(details).length > 0 ? details : null,
        success: res.statusCode < 400,
      });
    });

    next();
  };
}

export { auditAction };
