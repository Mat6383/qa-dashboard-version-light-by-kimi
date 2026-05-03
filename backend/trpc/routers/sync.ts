/**
 * ================================================
 * tRPC ROUTER — Sync
 * ================================================
 * Note: SSE endpoints (/execute, /status-to-gitlab) remain REST.
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import { adminProcedure } from '../middleware';
import { authedProcedure } from '../middleware';
import syncService from '../../services/sync.service';
import syncHistoryService from '../../services/syncHistory.service';
import autoSyncConfig from '../../services/auto-sync-config.service';
import gitlabServiceInstance from '../../services/gitlab.service';
import PROJECTS from '../../config/projects.config';
import logger from '../../services/logger.service';
import { TRPCError } from '@trpc/server';

const projectIdInput = z.object({
  projectId: z.string().min(1),
});

const iterationsInput = z.object({
  projectId: z.string().min(1),
  search: z.string().optional(),
});

const previewInput = z.object({
  projectId: z.string().min(1, '"projectId" requis'),
  iterationName: z.string().min(1, '"iterationName" requis'),
});

const iterationInput = z.object({
  iteration: z.string().min(1, 'Paramètre "iteration" requis'),
  isTest: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

const autoConfigInput = z
  .object({
    enabled: z.boolean().optional(),
    runId: z.number().int().positive().optional(),
    iterationName: z.string().optional(),
    gitlabProjectId: z.string().optional(),
    version: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    error: 'Aucun champ valide fourni',
  });

function findProject(projectId: string) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Projet "${projectId}" inconnu` });
  }
  if (!project.configured) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Projet "${project.label}" non configuré (pas d'accès GitLab)`,
    });
  }
  if (!project.gitlab.projectId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Projet "${project.label}" sans projectId GitLab`,
    });
  }
  return project;
}

export const syncRouter = router({
  projects: publicProcedure.query(() => {
    const list = PROJECTS.map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.configured,
    }));
    return { success: true as const, data: list, timestamp: new Date().toISOString() };
  }),

  iterations: publicProcedure
    .input(iterationsInput)
    .query(async ({ input }) => {
      const project = findProject(input.projectId);
      const iterations = await gitlabServiceInstance.searchIterations(project.gitlab.projectId, input.search || '');
      return {
        success: true as const,
        data: iterations.map((it: any) => ({
          id: it.id,
          title: it.title,
          state: it.state,
          web_url: it.web_url,
        })),
        timestamp: new Date().toISOString(),
      };
    }),

  preview: publicProcedure
    .input(previewInput)
    .mutation(async ({ input }) => {
      const project = findProject(input.projectId);
      logger.info(`Preview: ${project.label} / "${input.iterationName}"`);
      const preview = await syncService.previewIteration(input.iterationName, project);

      syncHistoryService.addRun(project.label, input.iterationName, 'preview', {
        created: preview.summary.toCreate,
        updated: preview.summary.toUpdate,
        skipped: preview.summary.toSkip,
        total: preview.summary.total,
      });

      return { success: true as const, data: preview, timestamp: new Date().toISOString() };
    }),

  history: publicProcedure.query(() => {
    const rows = syncHistoryService.getHistory(50);
    return { success: true as const, data: rows, timestamp: new Date().toISOString() };
  }),

  iteration: publicProcedure
    .input(iterationInput)
    .mutation(async ({ input }) => {
      logger.info(`Lancement sync itération "${input.iteration}"...`);
      const result = await syncService.syncIteration(input.iteration, {
        isTest: input.isTest,
        dryRun: input.dryRun,
      });
      return { success: true as const, data: result, timestamp: new Date().toISOString() };
    }),

  autoConfig: publicProcedure
    .query(() => {
      return { success: true as const, data: autoSyncConfig.getConfig(), timestamp: new Date().toISOString() };
    }),

  updateAutoConfig: publicProcedure
    .mutation(async ({ input }: { input: any }) => {
      const updated = autoSyncConfig.updateConfig(input);
      logger.info(`[AutoSync] Config mise à jour via tRPC: ${JSON.stringify(updated)}`);
      return { success: true as const, data: updated, timestamp: new Date().toISOString() };
    }),
});
