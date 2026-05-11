import { z } from 'zod';
import { router, publicProcedure } from '../init';
import analyticsService from '../../services/analytics.service';

export const analyticsRouter = router({
  list: publicProcedure
    .input(z.object({
      projectId: z.number().optional(),
      unreadOnly: z.boolean().optional(),
      limit: z.number().min(1).max(200).optional(),
    }).optional())
    .query(({ input }) => {
      analyticsService.init();
      return analyticsService.getInsights(input?.projectId, input?.unreadOnly, input?.limit ?? 50);
    }),

  markRead: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      analyticsService.init();
      analyticsService.markAsRead(input.id);
      return { success: true };
    }),

  markAllRead: publicProcedure
    .input(z.object({ projectId: z.number().optional() }).optional())
    .mutation(({ input }) => {
      analyticsService.init();
      analyticsService.markAllAsRead(input?.projectId);
      return { success: true };
    }),

  analyze: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(({ input }) => {
      analyticsService.init();
      return analyticsService.analyzeProject(input.projectId);
    }),
});
