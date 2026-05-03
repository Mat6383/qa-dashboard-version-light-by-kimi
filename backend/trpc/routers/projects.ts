/**
 * ================================================
 * tRPC ROUTER — Projects
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import testmoService from '../../services/testmo.service';

const projectIdInput = z.object({
  projectId: z.number().int().positive(),
});

const runsInput = z.object({
  projectId: z.number().int().positive(),
  active: z.boolean().optional().default(true),
});

export const projectsRouter = router({
  list: publicProcedure.query(async () => {
    const projectsRaw = await testmoService.getProjects();
    const projects = Array.isArray(projectsRaw) ? projectsRaw : (projectsRaw as any)?.result || [];
    return { success: true as const, data: { result: projects }, timestamp: new Date().toISOString() };
  }),

  runs: publicProcedure
    .input(runsInput)
    .query(async ({ input }) => {
      const runs = await testmoService.getProjectRuns(input.projectId, input.active);
      return { success: true as const, data: runs, timestamp: new Date().toISOString() };
    }),

  milestones: publicProcedure
    .input(projectIdInput)
    .query(async ({ input }) => {
      const milestones = await testmoService.getProjectMilestones(input.projectId);
      return { success: true as const, data: milestones, timestamp: new Date().toISOString() };
    }),

  automation: publicProcedure
    .input(projectIdInput)
    .query(async ({ input }) => {
      const automationRuns = await testmoService.getAutomationRuns(input.projectId);
      return { success: true as const, data: automationRuns, timestamp: new Date().toISOString() };
    }),
});
