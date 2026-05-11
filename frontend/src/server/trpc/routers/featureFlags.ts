/**
 * ================================================
 * tRPC ROUTER — Feature Flags
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import { adminProcedure } from '../middleware';
import featureFlagsService from '../../services/featureFlags.service';
import { TRPCError } from '@trpc/server';

const userIdInput = z.object({
  userId: z.string().optional(),
});

const keyInput = z.object({
  key: z.string().min(1),
});

const createInput = z.object({
  key: z.string().min(1, 'La clé du flag est requise'),
  enabled: z.boolean().optional(),
  description: z.string().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
});

const updateInput = z.object({
  enabled: z.boolean().optional(),
  description: z.string().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
});

export const featureFlagsRouter = router({
  list: publicProcedure
    .input(userIdInput.optional())
    .query(({ input }) => {
      const flags = featureFlagsService.getAll(input?.userId || null);
      return { success: true as const, data: flags, timestamp: new Date().toISOString() };
    }),

  get: publicProcedure
    .input(keyInput.merge(userIdInput))
    .query(({ input }) => {
      const enabled = featureFlagsService.isEnabled(input.key, false, input.userId as any);
      const details = featureFlagsService.getByKey(input.key);
      return {
        success: true as const,
        data: { key: input.key, enabled, rolloutPercentage: details ? details.rolloutPercentage : 100 },
        timestamp: new Date().toISOString(),
      };
    }),

  listAdmin: adminProcedure.query(() => {
    const flags = featureFlagsService.getAllDetails();
    return { success: true as const, data: flags, timestamp: new Date().toISOString() };
  }),

  create: adminProcedure
    .input(createInput)
    .mutation(({ input }) => {
      const existing = featureFlagsService.getByKey(input.key);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: `Le flag "${input.key}" existe déjà` });
      }
      const ok = featureFlagsService.create(input.key, {
        enabled: input.enabled,
        description: input.description,
        rolloutPercentage: input.rolloutPercentage,
      });
      if (!ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Création échouée' });
      }
      return { success: true as const, data: featureFlagsService.getByKey(input.key), timestamp: new Date().toISOString() };
    }),

  update: adminProcedure
    .input(z.object({ key: z.string().min(1) }).merge(updateInput))
    .mutation(({ input }) => {
      const { key, ...data } = input;
      const existing = featureFlagsService.getByKey(key);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Flag "${key}" introuvable` });
      }
      const ok = featureFlagsService.update(key, data);
      if (!ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Mise à jour échouée' });
      }
      return { success: true as const, data: featureFlagsService.getByKey(key), timestamp: new Date().toISOString() };
    }),

  delete: adminProcedure
    .input(keyInput)
    .mutation(({ input }) => {
      const existing = featureFlagsService.getByKey(input.key);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Flag "${input.key}" introuvable` });
      }
      const ok = featureFlagsService.delete(input.key);
      if (!ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Suppression échouée' });
      }
      return { success: true as const, deleted: true, timestamp: new Date().toISOString() };
    }),
});
