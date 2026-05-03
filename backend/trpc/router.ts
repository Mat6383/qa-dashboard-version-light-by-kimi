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
import { syncRouter } from './routers/sync';
import { crosstestRouter } from './routers/crosstest';
import { analyticsRouter } from './routers/analytics';
import { retentionRouter } from './routers/retention';
import { integrationsRouter } from './routers/integrations';

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
  sync: syncRouter,
  crosstest: crosstestRouter,
  analytics: analyticsRouter,
  retention: retentionRouter,
  integrations: integrationsRouter,
});

export type AppRouter = typeof appRouter;
