/**
 * ================================================
 * TESTMO DASHBOARD - Backend Server
 * ================================================
 * Point d'entrée Express : composition des middlewares,
 * routes, jobs et gestion du cycle de vie.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 2.0.0
 */

import './bootstrap/dotenv';
import express from 'express';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import logger from './services/logger.service';
import sentryService from './services/sentry.service';
import requestIdMiddleware from './middleware/requestId';
import requireAdminAuth from './middleware/adminAuth';
import { validate as validateEnv } from './bootstrap/envCheck';
import { setupSecurity } from './middleware/security';
import { metricsMiddleware } from './middleware/metrics';
import requestLogger from './middleware/requestLogger';
import autoSyncJob from './jobs/autoSyncJob';
import metricsSnapshotJob from './jobs/metricsSnapshotJob';
import auditPruneJob from './jobs/auditPruneJob';
import backupJob from './jobs/backupJob';
import analyticsJob from './jobs/analyticsJob';
import retentionJob from './jobs/retentionJob';
import gracefulShutdown from './bootstrap/gracefulShutdown';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createTRPCContext } from './trpc/context';

import syncHistoryService from './services/syncHistory.service';
import commentsService from './services/comments.service';
import metricSnapshotsService from './services/metricSnapshots.service';
import usersService from './services/users.service';
import auditService from './services/audit.service';
import analyticsService from './services/analytics.service';
import retentionService from './services/retention.service';
import integrationService from './services/integration.service';
import './services/webhooks.service';

import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import projectsRoutes from './routes/projects.routes';
import dashboardRoutes from './routes/dashboard.routes';
import runsRoutes from './routes/runs.routes';
import reportsRoutes from './routes/reports.routes';
import syncRoutes from './routes/sync.routes';
import testmoBrowserRoutes from './routes/testmoBrowser.routes';
import crosstestRoutes from './routes/crosstest.routes';
import notificationsRoutes from './routes/notifications.routes';
import pdfRoutes from './routes/pdf.routes';
import exportRoutes from './routes/export.routes';
import cacheRoutes from './routes/cache.routes';
import featureFlagsRoutes from './routes/featureFlags.routes';
import webhooksRoutes from './routes/webhooks.routes';
import { setupWebSocket } from './websocket';
import auditRoutes from './routes/audit.routes';
import anomaliesRoutes from './routes/anomalies.routes';
import docsRoutes from './routes/docs.routes';
import metricsRoutes from './routes/metrics.routes';
import backupsRoutes from './routes/backups.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Sentry & Request ID ────────────────────────────────────────────────────
sentryService.init(app);
app.use(requestIdMiddleware);

// ─── Validation env ─────────────────────────────────────────────────────────
validateEnv();

// ─── Sécurité (Helmet, CORS, Rate-limiting) ─────────────────────────────────
setupSecurity(app);

// ─── Logging ────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Prometheus metrics ─────────────────────────────────────────────────────
app.use(metricsMiddleware);

// ─── Services persistants ───────────────────────────────────────────────────
syncHistoryService.initDb();
commentsService.init();
metricSnapshotsService.init();
usersService.init();
auditService.init();

// ─── Passport & Cookies ─────────────────────────────────────────────────────
app.use(cookieParser());
app.use(passport.initialize());

// ─── tRPC ───────────────────────────────────────────────────────────────────
app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: createTRPCContext,
}));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/runs', runsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/testmo-browser', testmoBrowserRoutes);
app.use('/api/crosstest', crosstestRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/cache', requireAdminAuth, cacheRoutes);
app.use('/api/feature-flags', featureFlagsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/anomalies', anomaliesRoutes);
app.use('/api/docs', docsRoutes);
app.use('/metrics', metricsRoutes);
app.use('/api/admin/backups', requireAdminAuth, backupsRoutes);

// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// ─── Gestion globale des erreurs ────────────────────────────────────────────
const { errorHandler: sentryErrorHandler } = sentryService.getMiddlewares();
app.use(sentryErrorHandler);

app.use((err: any, req: any, res: any, _next: any) => {
  logger.error('Erreur non gérée:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message,
    timestamp: new Date().toISOString(),
  });
});

let server: any;

// ─── Démarrage (hors mode test) ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  autoSyncJob.start();
  metricsSnapshotJob.start();
  auditPruneJob.start();
  backupJob.start();
  analyticsJob.start();
  retentionJob.start();

  server = app.listen(PORT, () => {
    logger.info(`Server ready on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  setupWebSocket(server);

  server.on('error', (error: Error) => {
    logger.error('Erreur au démarrage du serveur:', (error as Error).message);
    process.exit(1);
  });

  gracefulShutdown.setup(server);
}

export { server };
export default app;
