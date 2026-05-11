/**
 * ================================================
 * tRPC ROUTER — Dashboard
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import testmoService from '../../services/testmo.service';
import notificationService from '../../services/notification.service';
import metricSnapshotsService from '../../services/metricSnapshots.service';
import logger from '../../services/logger.service';

const projectIdInput = z.object({
  projectId: z.number().int().positive(),
});

const milestonesInput = z.object({
  projectId: z.number().int().positive(),
  preprodMilestones: z.array(z.number().int().positive()).optional(),
  prodMilestones: z.array(z.number().int().positive()).optional(),
});

const trendsInput = z.object({
  projectId: z.number().int().positive(),
  granularity: z.enum(['day', 'week', 'month']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const compareInput = z.object({
  projectIds: z.array(z.number().int().positive()).min(2).max(4),
});

export const dashboardRouter = router({
  multiProjectSummary: publicProcedure.query(async () => {
    const projectsRaw = await testmoService.getProjects();
    const projects = Array.isArray(projectsRaw) ? projectsRaw : (projectsRaw as any)?.result || [];

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

    return { success: true as const, data: summaries, timestamp: new Date().toISOString() };
  }),

  metrics: publicProcedure
    .input(milestonesInput)
    .query(async ({ input }) => {
      logger.info(`Récupération métriques pour projet ${input.projectId}`);
      try {
        const metrics = await testmoService.getProjectMetrics(
          input.projectId,
          input.preprodMilestones || null,
          input.prodMilestones || null
        );

        if (!(metrics as any).slaStatus.ok) {
          logger.warn('Alertes SLA détectées:', {
            projectId: input.projectId,
            alerts: (metrics as any).slaStatus.alerts,
          });
          notificationService.dispatch(input.projectId, (metrics as any).slaStatus.alerts).catch(() => {
            /* silencieux */
          });
        }

        return { success: true as const, data: metrics, timestamp: new Date().toISOString() };
      } catch (err: any) {
        logger.warn(`[Metrics] Échec projet ${input.projectId}:`, err.message);
        return {
          success: true as const,
          data: {
            projectId: input.projectId,
            projectName: `Projet ${input.projectId}`,
            completionRate: 0,
            passRate: 0,
            failureRate: 0,
            blockedRate: 0,
            testEfficiency: 0,
            totalTests: 0,
            completedTests: 0,
            passedTests: 0,
            failedTests: 0,
            blockedTests: 0,
            untestedTests: 0,
            escapeRate: 0,
            detectionRate: 0,
            slaStatus: { ok: false, alerts: [{ severity: 'error', message: 'Données indisponibles' }] },
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        };
      }
    }),

  qualityRates: publicProcedure
    .input(milestonesInput)
    .query(async ({ input }) => {
      logger.info(`Récupération Quality Rates pour projet ${input.projectId}`);
      try {
        const rates = await testmoService.getEscapeAndDetectionRates(
          input.projectId,
          input.preprodMilestones as any,
          input.prodMilestones as any
        );
        return { success: true as const, data: rates, timestamp: new Date().toISOString() };
      } catch (err: any) {
        logger.warn(`[QualityRates] Échec projet ${input.projectId}:`, err.message);
        return {
          success: true as const,
          data: { escapeRate: 0, detectionRate: 0, preprodRuns: 0, prodRuns: 0, error: err.message },
          timestamp: new Date().toISOString(),
        };
      }
    }),

  annualTrends: publicProcedure
    .input(projectIdInput)
    .query(async ({ input }) => {
      logger.info(`Récupération Annual Trends pour projet ${input.projectId}`);
      try {
        const trends = await testmoService.getAnnualQualityTrends(input.projectId);
        return { success: true as const, data: trends, timestamp: new Date().toISOString() };
      } catch (err: any) {
        logger.warn(`[AnnualTrends] Échec projet ${input.projectId}:`, err.message);
        return { success: true as const, data: [], timestamp: new Date().toISOString() };
      }
    }),

  trends: publicProcedure
    .input(trendsInput)
    .query(({ input }) => {
      const trends = metricSnapshotsService.getTrends(
        input.projectId,
        input.granularity || 'day',
        input.from,
        input.to
      );
      return { success: true as const, data: trends, timestamp: new Date().toISOString() };
    }),

  compare: publicProcedure
    .input(compareInput)
    .query(async ({ input }) => {
      const comparisons = await Promise.all(
        input.projectIds.map(async (id) => {
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

      return { success: true as const, data: comparisons, timestamp: new Date().toISOString() };
    }),
});
