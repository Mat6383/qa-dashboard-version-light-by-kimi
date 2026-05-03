import express from 'express';
const router = express.Router();
import testmoService from '../services/testmo.service';
import logger from '../services/logger.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { auditAction } from '../middleware/audit.middleware';

/**
 * Nettoie le cache (maintenance)
 * LEAN: Gestion optimisée du cache
 */
router.post('/clear', auditAction('cache.clear'), (req, res) => {
  try {
    testmoService.clearCache();
    logger.info('Cache cleared manually');

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/cache/clear'));
  }
});

export default router;
