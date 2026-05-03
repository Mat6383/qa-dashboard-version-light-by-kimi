import express from 'express';
import fs from 'fs';
import path from 'path';
const router = express.Router();
import syncHistoryService from '../services/syncHistory.service';
import commentsService from '../services/comments.service';
import testmoService, { testmoBreaker } from '../services/testmo.service';
import gitlabService, { gitlabBreaker } from '../services/gitlab.service';
import { statusSyncBreaker } from '../services/status-sync.service';
import { getStats } from '../services/apiTimer.service';

// Cache pour health checks externes (évite de bombarder Testmo/GitLab sous charge)
const HEALTH_CACHE_TTL_MS = 10000;
let _cachedHealth: any = null;
let _cachedHealthAt = 0;

async function _getCachedExternalHealth() {
  const now = Date.now();
  if (_cachedHealth && now - _cachedHealthAt < HEALTH_CACHE_TTL_MS) {
    return _cachedHealth;
  }
  const [testmo, gitlab] = await Promise.all([
    testmoService.healthCheck({ timeout: 3000 }),
    gitlabService.healthCheck({ timeout: 3000 }),
  ]);
  _cachedHealth = { testmo, gitlab };
  _cachedHealthAt = now;
  return _cachedHealth;
}

/**
 * GET /api/health
 * Liveness probe — lightweight, no external calls
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    checks: { server: { status: 'OK' } },
  });
});

/**
 * Helper: run a DB check with actual response time measurement
 */
function checkDb(dbService: any, label: any) {
  const start = Date.now();
  try {
    if (!dbService.db) dbService.initDb ? dbService.initDb() : dbService.init();
    const db = dbService.db;
    const row = db?.prepare('SELECT 1 AS ok').get();
    return {
      status: row?.ok === 1 ? 'OK' : 'FAIL',
      responseTimeMs: Date.now() - start,
    };
  } catch (err: any) {
    return { status: 'FAIL', error: err.message, responseTimeMs: Date.now() - start };
  }
}

/**
 * Helper: disk usage check
 */
function checkDisk(): any {
  try {
    const backendDir = path.resolve(__dirname, '..');
    const stat = fs.statfsSync(backendDir);
    const totalBytes = stat.blocks * stat.bsize;
    const freeBytes = stat.bavail * stat.bsize;
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;
    return {
      status: 'OK',
      freeBytes,
      totalBytes,
      usagePercent,
    };
  } catch (err: any) {
    return { status: 'FAIL', error: err.message };
  }
}

/**
 * GET /api/health/ready
 * Readiness probe — DB + external APIs
 */
router.get('/ready', async (_req, res) => {
  const checks: any = {};
  let allOk = true;

  const db1 = checkDb(syncHistoryService, 'syncHistory');
  checks.syncHistoryDB = db1;
  if (db1.status !== 'OK') allOk = false;

  const db2 = checkDb(commentsService, 'comments');
  checks.commentsDB = db2;
  if (db2.status !== 'OK') allOk = false;

  const ext = await _getCachedExternalHealth();
  checks.testmoAPI = {
    status: ext.testmo.ok ? 'OK' : 'FAIL',
    responseTimeMs: ext.testmo.responseTimeMs,
    ...(ext.testmo.error && { error: ext.testmo.error }),
  };
  if (!ext.testmo.ok) allOk = false;

  checks.gitlabAPI = {
    status: ext.gitlab.ok ? 'OK' : 'FAIL',
    responseTimeMs: ext.gitlab.responseTimeMs,
    ...(ext.gitlab.error && { error: ext.gitlab.error }),
  };
  if (!ext.gitlab.ok) allOk = false;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /api/health/detailed
 * Full diagnostics for human operators / admin UI
 */
router.get('/detailed', async (_req, res) => {
  const checks: any = {};
  let allOk = true;

  // DB checks
  const db1 = checkDb(syncHistoryService, 'syncHistory');
  checks.syncHistoryDB = db1;
  if (db1.status !== 'OK') allOk = false;

  const db2 = checkDb(commentsService, 'comments');
  checks.commentsDB = db2;
  if (db2.status !== 'OK') allOk = false;

  // External API checks (avec cache 10s)
  const ext = await _getCachedExternalHealth();
  checks.testmoAPI = {
    status: ext.testmo.ok ? 'OK' : 'FAIL',
    responseTimeMs: ext.testmo.responseTimeMs,
    ...(ext.testmo.error && { error: ext.testmo.error }),
  };
  if (!ext.testmo.ok) allOk = false;

  checks.gitlabAPI = {
    status: ext.gitlab.ok ? 'OK' : 'FAIL',
    responseTimeMs: ext.gitlab.responseTimeMs,
    ...(ext.gitlab.error && { error: ext.gitlab.error }),
  };
  if (!ext.gitlab.ok) allOk = false;

  // Disk check
  const disk = checkDisk();
  if (disk.status !== 'OK') allOk = false;

  // Memory
  const mem = process.memoryUsage();

  // API stats
  const apiStats = getStats();

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    },
    disk,
    checks,
    apiStats,
  });
});

/**
 * GET /api/health/circuit-breakers
 * État des circuit breakers externes
 */
router.get('/circuit-breakers', (_req, res) => {
  res.json({
    success: true,
    data: [testmoBreaker.getStatus(), gitlabBreaker.getStatus(), statusSyncBreaker.getStatus()],
    timestamp: new Date().toISOString(),
  });
});

export default router;
