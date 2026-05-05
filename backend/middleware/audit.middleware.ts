import auditService from '../services/audit.service';
import type { Request, Response, NextFunction } from 'express';

interface AuditOptions {
  captureBody?: boolean;
  captureParams?: boolean;
}

/**
 * Crée un middleware d'audit pour une action donnée.
 * @param action - Identifiant de l'action (ex: 'sync.execute')
 * @param options
 */
function auditAction(action: string, options: AuditOptions = {}) {
  const { captureBody = false, captureParams = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      const user = req.user || null;
      const details: Record<string, unknown> = {};

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
