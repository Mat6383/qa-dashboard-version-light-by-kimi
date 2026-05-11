/**
 * ================================================
 * tRPC ROUTER — Crosstest (stub for type-check)
 * ================================================
 * Source of truth at runtime: backend_py/app/routers/trpc.py
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';

const commentSchema = z.object({
  issue_iid: z.number(),
  comment: z.string(),
  milestone_context: z.string().nullable(),
  updated_at: z.string(),
});

export const crosstestRouter = router({
  comments: publicProcedure.query(async () => {
    return [] as z.infer<typeof commentSchema>[];
  }),

  saveComment: publicProcedure
    .input(
      z.object({
        issue_iid: z.number(),
        comment: z.string(),
        milestoneContext: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        issue_iid: input.issue_iid,
        comment: input.comment,
        milestone_context: input.milestoneContext ?? null,
        updated_at: new Date().toISOString(),
      } as z.infer<typeof commentSchema>;
    }),

  deleteComment: publicProcedure
    .input(z.object({ issue_iid: z.number() }))
    .mutation(async () => {
      return { deleted: true };
    }),
});
