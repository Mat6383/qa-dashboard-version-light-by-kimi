import client from 'prom-client';
import fs from 'fs';
import path from 'path';
import logger from '../services/logger.service';

// Collecte des métriques par défaut (mémoire, CPU, event loop...)
client.collectDefaultMetrics({ prefix: 'qa_dashboard_' });

// Métriques HTTP custom
const httpRequestDuration = new client.Histogram({
  name: 'qa_dashboard_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsTotal = new client.Counter({
  name: 'qa_dashboard_http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status_code'],
});

const httpErrorsTotal = new client.Counter({
  name: 'qa_dashboard_http_errors_total',
  help: 'Nombre total de réponses HTTP en erreur (4xx/5xx)',
  labelNames: ['method', 'route', 'status_code'],
});

// Métriques business
const activeUsersGauge = new client.Gauge({
  name: 'qa_dashboard_active_users',
  help: "Nombre d'utilisateurs actuellement connectés (JWT valide)",
});

const dbSizeGauge = new client.Gauge({
  name: 'qa_dashboard_db_size_bytes',
  help: 'Taille des fichiers SQLite en bytes',
  labelNames: ['database'],
});

const syncRunsTotal = new client.Counter({
  name: 'qa_dashboard_sync_runs_total',
  help: 'Nombre total de synchronisations exécutées',
  labelNames: ['status'],
});

const exportRunsTotal = new client.Counter({
  name: 'qa_dashboard_export_runs_total',
  help: "Nombre total d'exports générés",
  labelNames: ['format'],
});

const alertThresholdGauge = new client.Gauge({
  name: 'qa_dashboard_alert_threshold',
  help: 'Seuils configurés pour les alertes',
  labelNames: ['metric'],
});

// Initialiser les seuils d'alerte
alertThresholdGauge.set({ metric: 'error_rate' }, Number(process.env.ALERT_ERROR_RATE_THRESHOLD) || 5);
alertThresholdGauge.set({ metric: 'memory' }, Number(process.env.ALERT_MEMORY_THRESHOLD) || 80);
alertThresholdGauge.set({ metric: 'disk' }, Number(process.env.ALERT_DISK_THRESHOLD) || 85);

/**
 * Met à jour la taille des bases SQLite (appelable périodiquement ou au scrape).
 */
function updateDbSizeMetrics() {
  try {
    const dbDir = path.join(__dirname, '..', 'db');
    const files = ['sync-history.db', 'crosstest-comments.db'];
    for (const file of files) {
      const fp = path.join(dbDir, file);
      if (fs.existsSync(fp)) {
        const stats = fs.statSync(fp);
        dbSizeGauge.set({ database: file }, stats.size);
      }
    }
  } catch (err: any) {
    logger.error('Metrics: Erreur lors de la lecture de la taille DB:', err.message);
  }
}

/**
 * Middleware Express qui instrumente les requêtes HTTP.
 */
function metricsMiddleware(req: any, res: any, next: any) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const durationSeconds = durationMs / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode.toString();

    httpRequestDuration.observe({ method: req.method, route, status_code: statusCode }, durationSeconds);
    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc({ method: req.method, route, status_code: statusCode });
    }
  });

  next();
}

const register = client.register;
export { metricsMiddleware, register, activeUsersGauge, dbSizeGauge, syncRunsTotal, exportRunsTotal, alertThresholdGauge, updateDbSizeMetrics };
