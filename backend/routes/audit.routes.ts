import express from 'express';
const router = express.Router();
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import auditService from '../services/audit.service';

/**
 * GET /api/audit
 * Liste paginée des entrées d'audit (admin uniquement)
 */
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const filters = {
    action: req.query.action || undefined,
    actorId: req.query.actorId ? parseInt(req.query.actorId as string, 10) : undefined,
    from: req.query.from || undefined,
    to: req.query.to || undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
  };

  const result = auditService.query(filters);
  res.json({ success: true, ...result });
});

export default router;
