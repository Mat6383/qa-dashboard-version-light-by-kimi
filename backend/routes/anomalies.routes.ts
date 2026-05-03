import express from 'express';
const router = express.Router();
import { detectAnomalies } from '../services/anomaly.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { validateParams, projectIdParam } from '../validators';

/**
 * GET /api/anomalies/:projectId
 * Détecte les anomalies sur les métriques historiques (z-score)
 */
router.get('/:projectId', validateParams(projectIdParam), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const anomalies = detectAnomalies(projectId);

    const hasAnomaly = anomalies.some((a) => a.severity !== 'normal');

    res.json({
      success: true,
      data: anomalies,
      hasAnomaly,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/anomalies/${req.params.projectId}`));
  }
});

export default router;
