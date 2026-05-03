import jwtService from '../services/auth/jwt.service';
import usersService from '../services/users.service';
import logger from '../services/logger.service';
import auditService from '../services/audit.service';

function extractToken(req: any) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.slice(7);
  }
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

function requireAuth(req: any, res: any, next: any) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise',
      timestamp: new Date().toISOString(),
    });
  }

  const payload = jwtService.verify(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Session expirée ou invalide',
      timestamp: new Date().toISOString(),
    });
  }

  const user = usersService.findById(payload.sub);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Utilisateur introuvable',
      timestamp: new Date().toISOString(),
    });
  }

  req.user = user;
  next();
}

function requireRole(...allowedRoles: any[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise',
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`[RBAC] Accès refusé pour ${req.user.email} (rôle: ${req.user.role}) sur ${req.path}`);
      auditService.log({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: 'rbac.denied',
        resource: 'auth',
        method: req.method,
        path: req.originalUrl || req.path,
        ip: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
        statusCode: 403,
        details: { requiredRoles: allowedRoles },
        success: false,
      });
      return res.status(403).json({
        success: false,
        error: 'Accès interdit — privilèges insuffisants',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

function requireAuthOrAdmin(req: any, res: any, next: any) {
  // 1. Essayer JWT classique
  const token = extractToken(req);
  if (token) {
    const payload = jwtService.verify(token);
    if (payload) {
      const user = usersService.findById(payload.sub);
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  // 2. Fallback X-Admin-Token (machine-to-machine / tests e2e)
  const adminToken = process.env.ADMIN_API_TOKEN;
  const provided = req.headers['x-admin-token'];
  if (adminToken && provided && provided === adminToken) {
    req.user = { id: 'admin', email: 'admin@system', role: 'admin', name: 'Admin' };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Authentification requise',
    timestamp: new Date().toISOString(),
  });
}

export { requireAuth, requireRole, extractToken, requireAuthOrAdmin };
