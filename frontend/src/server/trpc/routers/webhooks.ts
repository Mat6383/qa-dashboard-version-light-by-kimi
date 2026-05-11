/**
 * ================================================
 * tRPC ROUTER — Webhooks
 * ================================================
 */

import { z } from 'zod';
import { router } from '../init';
import { adminProcedure } from '../middleware';
import webhooksService from '../../services/webhooks.service';
import { TRPCError } from '@trpc/server';

const idInput = z.object({
  id: z.number().int().positive(),
});

const createInput = z.object({
  url: z.string().url('URL invalide'),
  events: z.array(z.string().min(1)).min(1, 'Au moins un event requis'),
  secret: z.string().min(1, 'Secret requis'),
  filters: z.record(z.string(), z.any()).nullable().optional(),
});

const updateInput = z.object({
  url: z.string().url('URL invalide').optional(),
  events: z.array(z.string().min(1)).min(1, 'Au moins un event requis').optional(),
  secret: z.string().min(1, 'Secret requis').optional(),
  enabled: z.boolean().optional(),
  filters: z.record(z.string(), z.any()).nullable().optional(),
});

export const webhooksRouter = router({
  list: adminProcedure.query(() => {
    const subs = webhooksService.getAll();
    return { success: true as const, data: subs, timestamp: new Date().toISOString() };
  }),

  create: adminProcedure
    .input(createInput)
    .mutation(({ input }) => {
      const sub = webhooksService.create(input.url, input.events, input.secret, input.filters);
      if (!sub) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Création échouée' });
      }
      return { success: true as const, data: sub, timestamp: new Date().toISOString() };
    }),

  update: adminProcedure
    .input(idInput.merge(updateInput))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      const existing = webhooksService.getById(id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook introuvable' });
      }
      const ok = webhooksService.update(id, data);
      if (!ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Mise à jour échouée' });
      }
      return { success: true as const, data: webhooksService.getById(id), timestamp: new Date().toISOString() };
    }),

  delete: adminProcedure
    .input(idInput)
    .mutation(({ input }) => {
      const existing = webhooksService.getById(input.id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook introuvable' });
      }
      const ok = webhooksService.delete(input.id);
      if (!ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Suppression échouée' });
      }
      return { success: true as const, deleted: true, timestamp: new Date().toISOString() };
    }),
});
