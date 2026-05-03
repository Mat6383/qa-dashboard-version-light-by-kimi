/**
 * ================================================
 * tRPC ROUTER — Crosstest
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import gitlabServiceInstance from '../../services/gitlab.service';
import commentsService from '../../services/comments.service';

const CROSSTEST_PROJECT_ID = 63;

const searchInput = z.object({
  search: z.string().optional(),
});

const iterationIdInput = z.object({
  iterationId: z.number().int().positive(),
});

const commentInput = z.object({
  issue_iid: z.number().int().positive('"issue_iid" requis'),
  comment: z.string().min(1, '"comment" requis'),
  milestone_context: z.string().nullable().optional(),
});

const iidInput = z.object({
  iid: z.number().int().positive('iid invalide'),
});

export const crosstestRouter = router({
  iterations: publicProcedure
    .input(searchInput.optional())
    .query(async ({ input }) => {
      const iterations = await gitlabServiceInstance.searchIterations(CROSSTEST_PROJECT_ID, input?.search || '');
      return {
        success: true as const,
        data: iterations.map((it: any) => ({ id: it.id, title: it.title, state: it.state })),
        timestamp: new Date().toISOString(),
      };
    }),

  issues: publicProcedure
    .input(iterationIdInput)
    .query(async ({ input }) => {
      const issues = await gitlabServiceInstance.getIssuesByLabelAndIterationForProject(
        CROSSTEST_PROJECT_ID,
        'CrossTest::OK',
        input.iterationId
      );

      const data = issues.map((issue: any) => ({
        iid: issue.iid,
        title: issue.title,
        url: issue.web_url,
        state: issue.state,
        assignees: (issue.assignees || []).map((a: any) => a.name),
        labels: (issue.labels || []).filter((l: any) => l !== 'CrossTest::OK'),
        created_at: issue.created_at,
        closed_at: issue.closed_at || null,
      }));

      return { success: true as const, data, timestamp: new Date().toISOString() };
    }),

  comments: publicProcedure.query(() => {
    const data = commentsService.getAll();
    return { success: true as const, data, timestamp: new Date().toISOString() };
  }),

  saveComment: publicProcedure
    .input(commentInput)
    .mutation(({ input }) => {
      const row = commentsService.upsert(input.issue_iid, input.comment, (input.milestone_context || null) as any);
      return { success: true as const, data: row, timestamp: new Date().toISOString() };
    }),

  deleteComment: publicProcedure
    .input(iidInput)
    .mutation(({ input }) => {
      const deleted = commentsService.delete(input.iid);
      return { success: true as const, deleted, timestamp: new Date().toISOString() };
    }),
});
