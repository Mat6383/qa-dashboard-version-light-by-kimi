import express from 'express';
const router = express.Router();
import testmoService from '../services/testmo.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { validateParams, validateQuery, runIdParam, runResultsQuery } from '../validators';

/**
 * Détails d'un run spécifique
 * ISTQB: Test Reporting
 */
router.get('/:runId', validateParams(runIdParam), async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);

    const runDetails = await testmoService.getRunDetails(runId);

    res.json({
      success: true,
      data: runDetails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/runs/${req.params.runId}`));
  }
});

/**
 * Résultats détaillés d'un run
 * API Testmo 2025: Nouveau endpoint
 */
router.get('/:runId/results', validateParams(runIdParam), validateQuery(runResultsQuery), async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
    const statusFilter = req.query.status; // Ex: '3,5' pour Failed+Blocked

    const results = await testmoService.getRunResults(runId, (statusFilter as string) || undefined);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/runs/${req.params.runId}/results`));
  }
});

export default router;
