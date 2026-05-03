/**
 * ================================================
 * tRPC ROUTER — Anomalies & Circuit Breakers
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import { detectAnomalies } from '../../services/anomaly.service';
import { testmoBreaker } from '../../services/testmo.service';
import { gitlabBreaker } from '../../services/gitlab.service';
import { statusSyncBreaker } from '../../services/status-sync.service';

const projectIdInput = z.object({
  projectId: z.number().int().positive(),
});

export const anomaliesRouter = router({
  list: publicProcedure
    .input(projectIdInput)
    .query(({ input }) => {
      const anomalies = detectAnomalies(input.projectId);
      const hasAnomaly = anomalies.some((a) => a.severity !== 'normal');
      return {
        success: true as const,
        data: anomalies,
        hasAnomaly,
        timestamp: new Date().toISOString(),
      };
    }),

  circuitBreakers: publicProcedure.query(() => {
    return {
      success: true as const,
      data: [testmoBreaker.getStatus(), gitlabBreaker.getStatus(), statusSyncBreaker.getStatus()],
      timestamp: new Date().toISOString(),
    };
  }),
});
