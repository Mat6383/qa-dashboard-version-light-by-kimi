/**
 * ================================================
 * tRPC ROUTER — Runs
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import testmoService from '../../services/testmo.service';

const runIdInput = z.object({
  runId: z.number().int().positive(),
});

const runResultsInput = z.object({
  runId: z.number().int().positive(),
  status: z.string().optional(),
});

export const runsRouter = router({
  details: publicProcedure
    .input(runIdInput)
    .query(async ({ input }) => {
      const runDetails = await testmoService.getRunDetails(input.runId);
      return { success: true as const, data: runDetails, timestamp: new Date().toISOString() };
    }),

  results: publicProcedure
    .input(runResultsInput)
    .query(async ({ input }) => {
      const results = await testmoService.getRunResults(input.runId, input.status || undefined);
      return { success: true as const, data: results, timestamp: new Date().toISOString() };
    }),
});
