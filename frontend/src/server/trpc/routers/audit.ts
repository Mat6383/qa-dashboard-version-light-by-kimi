/**
 * ================================================
 * tRPC ROUTER — Audit Logs
 * ================================================
 */

import { z } from 'zod';
import { router } from '../init';
import { adminProcedure } from '../middleware';
import auditService from '../../services/audit.service';

const auditQueryInput = z.object({
  action: z.string().optional(),
  actorId: z.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const auditRouter = router({
  logs: adminProcedure
    .input(auditQueryInput.optional())
    .query(({ input }) => {
      const filters = input || {};
      const result = auditService.query(filters);
      return { success: true as const, ...result };
    }),
});
