/**
 * ================================================
 * TESTMO BROWSER ROUTES
 * ================================================
 * Endpoints pour créer / mettre à jour des runs manuels Testmo
 * via automation navigateur (Puppeteer).
 *
 * Routes:
 *   POST /api/testmo-browser/runs              → créer un run manuel
 *   POST /api/testmo-browser/runs/:id/results  → ajouter des résultats
 *   GET  /api/testmo-browser/health            → test auth UI
 */

import express from 'express';
import logger from '../services/logger.service';
import testmoBrowserService from '../services/testmoBrowser.service';
import { safeErrorResponse } from '../utils/errorResponse';
import requireAdminAuth from '../middleware/adminAuth';

const router = express.Router();

// ─── POST /api/testmo-browser/runs ──────────────────────────────────────────
// Body: { projectId: number, name: string, milestoneId?, configId?, caseIds?[] }
router.post('/runs', requireAdminAuth, async (req, res) => {
  try {
    const { projectId, name, milestoneId, configId, caseIds } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({
        success: false,
        error: 'projectId and name are required',
      });
    }

    logger.info(`[TestmoBrowserAPI] Creating manual run "${name}" in project ${projectId}`);

    const result = await testmoBrowserService.createManualRun(Number(projectId), {
      name: String(name),
      milestoneId: milestoneId ? Number(milestoneId) : undefined,
      configId: configId ? Number(configId) : undefined,
      caseIds: Array.isArray(caseIds) ? caseIds.map(Number) : undefined,
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[TestmoBrowserAPI] Create run error:', error);
    res.status(500).json(safeErrorResponse(error, 'POST /api/testmo-browser/runs'));
  }
});

// ─── POST /api/testmo-browser/runs/:runId/results ───────────────────────────
// Body: { projectId: number, results: [{ caseId?, testId?, status, note?, elapsed? }] }
router.post('/runs/:runId/results', requireAdminAuth, async (req, res) => {
  try {
    const runId = Number(req.params.runId);
    const { projectId, results } = req.body;

    if (!runId || !projectId || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        error: 'runId, projectId and results[] are required',
      });
    }

    logger.info(`[TestmoBrowserAPI] Adding ${results.length} results to run ${runId}`);

    const stats = await testmoBrowserService.addRunResults(Number(projectId), runId, results);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[TestmoBrowserAPI] Add results error:', error);
    res.status(500).json(safeErrorResponse(error, 'POST /api/testmo-browser/runs/:runId/results'));
  }
});

// ─── GET /api/testmo-browser/health ─────────────────────────────────────────
router.get('/health', requireAdminAuth, async (_req, res) => {
  try {
    const check = await testmoBrowserService.healthCheck();
    const statusCode = check.ok ? 200 : 503;
    res.status(statusCode).json({
      success: check.ok,
      data: check,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json(safeErrorResponse(error, 'GET /api/testmo-browser/health'));
  }
});

export default router;
