import express from 'express';
const router = express.Router();
import logger from '../services/logger.service';
import syncService from '../services/sync.service';
import syncHistoryService from '../services/syncHistory.service';
import statusSyncService from '../services/status-sync.service';
import autoSyncConfig from '../services/auto-sync-config.service';
import PROJECTS from '../config/projects.config';
import gitlabServiceInstance from '../services/gitlab.service';
import requireAdminAuth from '../middleware/adminAuth';
import { safeErrorResponse } from '../utils/errorResponse';
import { auditAction } from '../middleware/audit.middleware';
import { syncRunsTotal } from '../middleware/metrics';

import {
  validateParams,
  validateBody,
  syncProjectIdParam,
  syncPreviewBody,
  syncExecuteBody,
  syncIterationBody,
  syncStatusToGitlabBody,
  autoConfigBody,
} from '../validators';

// ---- Dashboard 6: Multi-project Sync API --------------------------------

/**
 * GET /api/sync/projects
 * Retourne la liste des projets configurés (id, label, configured)
 */
router.get('/projects', (req, res) => {
  const list = PROJECTS.map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.configured,
  }));
  res.json({ success: true, data: list, timestamp: new Date().toISOString() });
});

/**
 * GET /api/sync/:projectId/iterations
 * Recherche les itérations GitLab d'un projet
 * Query: ?search=R14
 */
router.get('/:projectId/iterations', validateParams(syncProjectIdParam), async (req, res) => {
  try {
    const { projectId } = req.params;
    const search = (req.query.search as string) || '';

    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    }
    if (!project.configured) {
      return res
        .status(400)
        .json({ success: false, error: `Projet "${project.label}" non configuré (pas d'accès GitLab)` });
    }
    if (!project.gitlab.projectId) {
      return res.status(400).json({ success: false, error: `Projet "${project.label}" sans projectId GitLab` });
    }

    const iterations = await gitlabServiceInstance.searchIterations(project.gitlab.projectId, search);

    res.json({
      success: true,
      data: iterations.map((it) => ({
        id: it.id,
        title: it.title,
        state: it.state,
        web_url: it.web_url,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/sync/${req.params.projectId}/iterations`));
  }
});

/**
 * POST /api/sync/preview
 * Body: { projectId, iterationName }
 * Dry-run — retourne { iteration, folder, issues, summary }
 */
router.post('/preview', validateBody(syncPreviewBody), async (req, res) => {
  try {
    const { projectId, iterationName, labelCustom, status, version, versionDeTest } = req.body;

    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    }
    if (!project.configured) {
      return res.status(400).json({
        success: false,
        error: `Projet "${project.label}" non configuré — accès GitLab manquant`,
      });
    }

    logger.info(`Preview: ${project.label} / "${iterationName}"`);
    const preview = await syncService.previewIteration(iterationName, project, { labelCustom, status, version, versionDeTest });

    // Enregistrer le preview en historique
    syncHistoryService.addRun(project.label, iterationName, 'preview', {
      created: preview.summary.toCreate,
      updated: preview.summary.toUpdate,
      skipped: preview.summary.toSkip,
      total: preview.summary.total,
    });

    res.json({ success: true, data: preview, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/sync/preview'));
  }
});

/**
 * POST /api/sync/execute
 * Body: { projectId, iterationName }
 * Exécute la synchronisation avec streaming SSE
 */
router.post('/execute', validateBody(syncExecuteBody), auditAction('sync.execute'), async (req, res) => {
  const { projectId, iterationName, labelCustom, status, version, versionDeTest } = req.body;

  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
  }
  if (!project.configured) {
    return res.status(400).json({
      success: false,
      error: `Projet "${project.label}" non configuré — accès GitLab manquant`,
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering nginx si présent
  res.flushHeaders();

  const send = (type: any, data = {}) => {
    const payload = JSON.stringify({ type, ...data });
    res.write(`data: ${payload}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  // Heartbeat pour garder la connexion vivante
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  try {
    logger.info(`Execute: ${project.label} / "${iterationName}"`);

    const stats = await syncService.syncIteration(iterationName, { projectConfig: project, labelCustom, status, version, versionDeTest }, (type: any, data: any) =>
      send(type, data)
    );

    // Enregistrer en historique
    syncHistoryService.addRun(project.label, iterationName, 'execute', stats);

    // Prometheus metrics
    syncRunsTotal.inc({ status: (stats as any).error ? 'failure' : 'success' });

    // 'done' a déjà été émis par syncIteration, mais on s'assure
    if (!(stats as any).error) {
      // déjà émis — ne pas doubler
    }
  } catch (error) {
    logger.error('Execute SSE error:', error);
    send('error', { message: 'Erreur interne du serveur' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * GET /api/sync/history
 * Retourne les 50 derniers runs depuis SQLite
 */
router.get('/history', (req, res) => {
  try {
    const rows = syncHistoryService.getHistory(50);
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/sync/history'));
  }
});

/**
 * Test API Testmo — Valide les endpoints folders/cases (beta)
 * Crée un dossier [TEST-API] R06 > R06 - run 1 + un case de test
 */
router.post('/test-api', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Lancement test API Testmo...');
    const result = await syncService.testTestmoApi();
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/sync/test-api'));
  }
});

/**
 * Synchronise une itération GitLab vers Testmo
 * Body: { iteration: "R06 - run 1", isTest: false, dryRun: false }
 */
router.post('/iteration', validateBody(syncIterationBody), async (req, res) => {
  try {
    const { iteration, isTest = false, dryRun = false } = req.body;
    logger.info(`Lancement sync itération "${iteration}"...`);
    const result = await syncService.syncIteration(iteration, { isTest, dryRun });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/sync/iteration'));
  }
});

/**
 * POST /api/sync/status-to-gitlab
 * Synchronise les statuts Testmo d'un run vers les labels GitLab.
 * Utilise SSE pour le streaming de la progression.
 *
 * Body: { runId, iterationName, gitlabProjectId, dryRun, version? }
 */
router.post('/status-to-gitlab', validateBody(syncStatusToGitlabBody), async (req, res) => {
  const { runId, iterationName, gitlabProjectId, dryRun = false, version } = req.body;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type: any, data = {}) => {
    const payload = JSON.stringify({ type, ...data });
    res.write(`data: ${payload}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  try {
    logger.info(`StatusSync: run=${runId} iteration="${iterationName}" glProject=${gitlabProjectId}`);

    await statusSyncService.syncRunStatusToGitLab(
      runId,
      iterationName,
      gitlabProjectId,
      (type: any, data: any) => send(type, data),
      Boolean(dryRun),
      version || null
    );
  } catch (error) {
    logger.error('Erreur POST /api/sync/status-to-gitlab:', error);
    send('error', { message: 'Erreur interne du serveur' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * Nettoyage du dossier de test [TEST-API]
 */
router.delete('/test-cleanup', requireAdminAuth, async (req, res) => {
  try {
    const result = await syncService.cleanupTestFolder();
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'DELETE /api/sync/test-cleanup'));
  }
});

// ─── Routes API : lecture / mise à jour de la config cron auto-sync ──────────

/**
 * GET /api/sync/auto-config
 * Retourne la configuration courante du cron auto-sync
 */
router.get('/auto-config', (req, res) => {
  res.json({ success: true, data: autoSyncConfig.getConfig(), timestamp: new Date().toISOString() });
});

/**
 * PUT /api/sync/auto-config
 * Met à jour la config à chaud (pas de redémarrage nécessaire)
 *
 * Body (tous les champs sont optionnels) :
 *   { enabled, runId, iterationName, gitlabProjectId }
 */
router.put('/auto-config', validateBody(autoConfigBody), auditAction('sync.config.update'), (req, res) => {
  try {
    const { enabled, runId, iterationName, gitlabProjectId } = req.body;
    const patch: any = {};
    if (enabled !== undefined) patch.enabled = Boolean(enabled);
    if (runId !== undefined) patch.runId = parseInt(runId);
    if (iterationName !== undefined) patch.iterationName = String(iterationName).trim();
    if (gitlabProjectId !== undefined) patch.gitlabProjectId = String(gitlabProjectId).trim();

    const updated = autoSyncConfig.updateConfig(patch);
    logger.info(`[AutoSync] Config mise à jour via API: ${JSON.stringify(updated)}`);
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json(safeErrorResponse(err, 'PUT /api/sync/auto-config'));
  }
});

export default router;
