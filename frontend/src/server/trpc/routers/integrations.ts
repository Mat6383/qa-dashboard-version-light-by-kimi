/**
 * ================================================
 * tRPC ROUTER — Integrations (stub for type-check)
 * ================================================
 * Source of truth at runtime: backend_py/app/routers/trpc.py
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';

const integrationSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  last_sync_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const integrationsRouter = router({
  list: publicProcedure.query(async () => {
    return [] as z.infer<typeof integrationSchema>[];
  }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async () => {
      return null as z.infer<typeof integrationSchema> | null;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.string(),
        config: z.record(z.string(), z.unknown()),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        ...input,
        id: 0,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as z.infer<typeof integrationSchema>;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        type: z.string().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        ...input,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as z.infer<typeof integrationSchema>;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async () => {
      return { success: true };
    }),

  testConnection: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async () => {
      return { success: true, message: 'OK' };
    }),

  createJiraIssue: publicProcedure
    .input(
      z.object({
        integrationId: z.number(),
        projectKey: z.string(),
        summary: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async () => {
      return { success: true, issueKey: 'TEST-1', url: '' };
    }),

  gitlabProjects: publicProcedure
    .input(z.object({ integrationId: z.number() }))
    .query(async () => {
      return [] as Array<{ id: number; name: string; path_with_namespace: string }>;
    }),

  gitlabIssues: publicProcedure
    .input(
      z.object({
        integrationId: z.number(),
        search: z.string().optional(),
        state: z.string().optional(),
      })
    )
    .query(async () => {
      return [] as Array<{ iid: number; title: string; state: string; web_url: string }>;
    }),
});
