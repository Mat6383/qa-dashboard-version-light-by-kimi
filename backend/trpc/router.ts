/**
 * ================================================
 * tRPC APP ROUTER
 * ================================================
 * Merge of all sub-routers. Exported as AppRouter type.
 */

import { router } from './init';
import { dashboardRouter } from './routers/dashboard';
import { projectsRouter } from './routers/projects';
import { runsRouter } from './routers/runs';
import { anomaliesRouter } from './routers/anomalies';
import { featureFlagsRouter } from './routers/featureFlags';
import { webhooksRouter } from './routers/webhooks';
import { auditRouter } from './routers/audit';
import { cacheRouter } from './routers/cache';
import { notificationsRouter } from './routers/notifications';
import { reportsRouter } from './routers/reports';
import { analyticsRouter } from './routers/analytics';
import { retentionRouter } from './routers/retention';

export const appRouter = router({
  dashboard: dashboardRouter,
  projects: projectsRouter,
  runs: runsRouter,
  anomalies: anomaliesRouter,
  featureFlags: featureFlagsRouter,
  webhooks: webhooksRouter,
  audit: auditRouter,
  cache: cacheRouter,
  notifications: notificationsRouter,
  reports: reportsRouter,
  analytics: analyticsRouter,
  retention: retentionRouter,
});

export type AppRouter = typeof appRouter;
