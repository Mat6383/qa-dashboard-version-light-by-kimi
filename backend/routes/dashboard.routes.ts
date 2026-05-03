import express from 'express';
const router = express.Router();
import testmoService from '../services/testmo.service';
import notificationService from '../services/notification.service';
import metricSnapshotsService from '../services/metricSnapshots.service';
import logger from '../services/logger.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { validateParams, validateQuery, projectIdParam, milestonesQuery } from '../validators';

/**
 * Synthèse multi-projets
 * Agrège les métriques clés de tous les projets Testmo
 */
router.get('/multi', async (req, res) => {
  try {
    const projectsRaw = await testmoService.getProjects();
    const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw?.result || [];
    const summaries = await Promise.all(
      projects.map(async (project: any) => {
        try {
          const metrics = await testmoService.getProjectMetrics(project.id);
          return {
            projectId: project.id,
            projectName: project.name,
            passRate: metrics.passRate,
            completionRate: metrics.completionRate,
            blockedRate: metrics.blockedRate,
            escapeRate: (metrics as any).escapeRate || 0,
            detectionRate: (metrics as any).detectionRate || 0,
            slaStatus: (metrics as any).slaStatus,
            timestamp: metrics.timestamp,
          };
        } catch (err: any) {
          logger.warn(`[MultiProject] Échec metrics projet ${project.id}:`, err.message);
          return {
            projectId: project.id,
            projectName: project.name,
            passRate: null,
            completionRate: null,
            blockedRate: null,
            escapeRate: null,
            detectionRate: null,
            slaStatus: { ok: false, alerts: [{ severity: 'error', message: 'Données indisponibles' }] },
            timestamp: new Date().toISOString(),
          };
        }
      })
    );

    res.json({
      success: true,
      data: summaries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/dashboard/multi'));
  }
});

/**
 * Comparaison multi-projets (radar chart data)
 */
router.get('/compare', async (req, res) => {
  try {
    const projectIds = ((req.query.projectIds || '') as string)
      .split(',')
      .map(Number)
      .filter((id) => !isNaN(id) && id > 0);

    if (projectIds.length < 2) {
      return res.status(400).json({ success: false, error: 'Au moins 2 projectIds requis' });
    }
    if (projectIds.length > 4) {
      return res.status(400).json({ success: false, error: 'Maximum 4 projets comparables' });
    }

    const comparisons = await Promise.all(
      projectIds.map(async (id) => {
        try {
          const metrics = await testmoService.getProjectMetrics(id);
          return {
            projectId: id,
            projectName: (metrics as any).projectName || `Projet ${id}`,
            passRate: metrics.passRate ?? 0,
            completionRate: metrics.completionRate ?? 0,
            escapeRate: (metrics as any).escapeRate ?? 0,
            detectionRate: (metrics as any).detectionRate ?? 0,
            blockedRate: metrics.blockedRate ?? 0,
          };
        } catch (err: any) {
          logger.warn(`[Compare] Échec metrics projet ${id}:`, err.message);
          return {
            projectId: id,
            projectName: `Projet ${id}`,
            passRate: 0,
            completionRate: 0,
            escapeRate: 0,
            detectionRate: 0,
            blockedRate: 0,
          };
        }
      })
    );

    res.json({ success: true, data: comparisons, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/dashboard/compare'));
  }
});

/**
 * Métriques ISTQB complètes d'un projet
 * ISTQB Section 5.4.2: Test Summary Report
 * Endpoint principal du dashboard
 */
router.get('/:projectId', validateParams(projectIdParam), validateQuery(milestonesQuery), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const preprodMilestones = req.query.preprodMilestones ? (req.query.preprodMilestones as any).split(',').map(Number) : null;
    const prodMilestones = req.query.prodMilestones ? (req.query.prodMilestones as any).split(',').map(Number) : null;

    logger.info(`Récupération métriques pour projet ${projectId}`);
    const metrics = await testmoService.getProjectMetrics(projectId, preprodMilestones, prodMilestones);

    // Log + alerte des alertes SLA (ITIL)
    if (!(metrics as any).slaStatus.ok) {
      logger.warn('Alertes SLA détectées:', {
        projectId,
        alerts: (metrics as any).slaStatus.alerts,
      });
      notificationService.dispatch(projectId, (metrics as any).slaStatus.alerts).catch(() => {
        /* silencieux — ne pas impacter le client */
      });
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/dashboard/${req.params.projectId}`));
  }
});

/**
 * Taux d'échappement et de détection
 * Endpoint pour le Dashboard 3
 */
router.get(
  '/:projectId/quality-rates',
  validateParams(projectIdParam),
  validateQuery(milestonesQuery),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const preprodMilestones = req.query.preprodMilestones ? (req.query.preprodMilestones as string).split(',').map(Number) : null;
      const prodMilestones = req.query.prodMilestones ? (req.query.prodMilestones as string).split(',').map(Number) : null;

      logger.info(`Récupération Quality Rates pour projet ${projectId}`);
      const rates = await testmoService.getEscapeAndDetectionRates(projectId, preprodMilestones as any, prodMilestones as any);

      res.json({
        success: true,
        data: rates,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json(safeErrorResponse(error, `GET /api/dashboard/${req.params.projectId}/quality-rates`));
    }
  }
);

/**
 * Tendances annuelles de qualité (Dashboard 5)
 * ISTQB: Test Process Improvement
 */
router.get('/:projectId/annual-trends', validateParams(projectIdParam), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    logger.info(`Récupération Annual Trends pour projet ${projectId}`);
    const trends = await testmoService.getAnnualQualityTrends(projectId);

    res.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/dashboard/${req.params.projectId}/annual-trends`));
  }
});

/**
 * Tendances historiques (snapshots)
 * Granularity: day | week | month
 */
router.get('/:projectId/trends', validateParams(projectIdParam), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { granularity = 'day', from, to } = req.query;
    const trends = metricSnapshotsService.getTrends(projectId, granularity as string, from as string, to as string);
    res.json({ success: true, data: trends, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/dashboard/${req.params.projectId}/trends`));
  }
});

/**
 * Stream SSE temps réel des métriques dashboard
 * Polling toutes les 30s avec push uniquement si données changées
 */
router.get('/:projectId/stream', validateParams(projectIdParam), validateQuery(milestonesQuery), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const preprodMilestones = req.query.preprodMilestones ? (req.query.preprodMilestones as string).split(',').map(Number) : null;
    const prodMilestones = req.query.prodMilestones ? (req.query.prodMilestones as string).split(',').map(Number) : null;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: any, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    };

    let lastHash: any = null;
    let closed = false;

    const fetchAndSend = async () => {
      if (closed) return;
      try {
        const [metrics, qualityRates] = await Promise.all([
          testmoService.getProjectMetrics(projectId, preprodMilestones as any, prodMilestones as any),
          testmoService.getEscapeAndDetectionRates(projectId, preprodMilestones as any, prodMilestones as any),
        ]);
        const payload = { metrics, qualityRates, timestamp: new Date().toISOString() };
        const hash = JSON.stringify(payload);
        if (hash !== lastHash) {
          lastHash = hash;
          send('metrics', payload);
        }
      } catch (err: any) {
        if (!closed) {
          logger.warn(`[SSE Dashboard ${projectId}]`, err.message);
          send('error', { message: err.message });
        }
      }
    };

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (!closed) {
        res.write(': ping\n\n');
        if (typeof res.flush === 'function') res.flush();
      }
    }, 15000);

    // Premier envoi immédiat
    await fetchAndSend();

    // Polling périodique
    const poll = setInterval(fetchAndSend, 30000);

    req.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      clearInterval(poll);
    });
  } catch (error) {
    // Si les headers SSE ne sont pas encore envoyés, on peut renvoyer une erreur JSON classique
    if (!res.headersSent) {
      res.status(500).json(safeErrorResponse(error, `GET /api/dashboard/${req.params.projectId}/stream`));
    }
  }
});

export default router;
