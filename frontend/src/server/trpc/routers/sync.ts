/**
 * ================================================
 * tRPC ROUTER — Sync (stub for type-check)
 * ================================================
 * Source of truth at runtime: backend_py/app/routers/trpc.py
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';

const autoSyncConfigSchema = z.object({
  enabled: z.boolean(),
  runId: z.number().nullable(),
  iterationName: z.string().nullable(),
  gitlabProjectId: z.string().nullable(),
  testmoProjectId: z.number().nullable().optional(),
  updatedAt: z.string().nullable(),
  version: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  gitlabStatus: z.string().nullable().optional(),
  versionProd: z.string().nullable().optional(),
  versionTest: z.string().nullable().optional(),
});

export const syncRouter = router({
  autoConfig: publicProcedure.query(async () => {
    return {
      enabled: false,
      runId: null,
      iterationName: null,
      gitlabProjectId: null,
      testmoProjectId: null,
      updatedAt: null,
      version: null,
      label: null,
      gitlabStatus: null,
      versionProd: null,
      versionTest: null,
    } as z.infer<typeof autoSyncConfigSchema>;
  }),

  updateAutoConfig: publicProcedure
    .input(autoSyncConfigSchema.partial())
    .mutation(async ({ input }) => {
      return {
        ...input,
        updatedAt: new Date().toISOString(),
      } as z.infer<typeof autoSyncConfigSchema>;
    }),

  previewCases: publicProcedure
    .input(
      z.object({
        gitlabProjectId: z.string(),
        iterationName: z.string(),
        testmoProjectId: z.number(),
        folderName: z.string().optional(),
      })
    )
    .mutation(async () => {
      return {
        iteration: { name: '', id: 0 },
        folder: null,
        issues: [],
        summary: { toCreate: 0, toUpdate: 0, toSkip: 0, total: 0 },
      };
    }),

  executeCases: publicProcedure
    .input(
      z.object({
        gitlabProjectId: z.string(),
        iterationName: z.string(),
        testmoProjectId: z.number(),
        folderName: z.string().optional(),
        dryRun: z.boolean().optional(),
      })
    )
    .mutation(async () => {
      return {
        success: true,
        data: null,
        timestamp: new Date().toISOString(),
      };
    }),

  casesHistory: publicProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async () => {
      return [] as Array<{
        id: number;
        project_name: string;
        iteration_name: string;
        mode: string;
        created: number;
        updated: number;
        skipped: number;
        enriched: number;
        errors: number;
        total_issues: number;
        testmo_run_id: number | null;
        testmo_run_url: string | null;
        executed_at: string;
      }>;
    }),
});
