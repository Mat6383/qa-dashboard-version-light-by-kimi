import express from 'express';
import requireAdminAuth from '../middleware/adminAuth';
import backupService from '../services/backup.service';
import { safeErrorResponse } from '../utils/errorResponse';

const router = express.Router();

/**
 * GET /api/admin/backups
 * Liste les backups locaux avec métadonnées.
 */
router.get('/', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({
      success: true,
      data: backups,
      count: backups.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/admin/backups'));
  }
});

/**
 * POST /api/admin/backups
 * Déclenche un backup manuel immédiat.
 */
router.post('/', async (req, res) => {
  try {
    const results = await backupService.runBackup();
    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/admin/backups'));
  }
});

export default router;
