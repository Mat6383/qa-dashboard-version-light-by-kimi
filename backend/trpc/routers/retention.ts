import { z } from 'zod';
import { router, publicProcedure } from '../init';
import retentionService from '../../services/retention.service';

export const retentionRouter = router({
  policies: publicProcedure.query(() => {
    retentionService.init();
    return retentionService.getPolicies();
  }),

  updatePolicy: publicProcedure
    .input(z.object({
      entityType: z.string(),
      retentionDays: z.number().min(1).max(3650).optional(),
      autoArchive: z.boolean().optional(),
      autoDelete: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      retentionService.init();
      return retentionService.updatePolicy(input.entityType, {
        retention_days: input.retentionDays,
        auto_archive: input.autoArchive,
        auto_delete: input.autoDelete,
      });
    }),

  archives: publicProcedure
    .input(z.object({
      entityType: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional())
    .query(({ input }) => {
      retentionService.init();
      return retentionService.getArchives(input?.entityType, input?.limit ?? 100);
    }),

  runCycle: publicProcedure.mutation(() => {
    retentionService.init();
    return retentionService.runRetentionCycle();
  }),
});
