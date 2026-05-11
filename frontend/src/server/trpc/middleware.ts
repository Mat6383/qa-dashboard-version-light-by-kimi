/**
 * ================================================
 * tRPC MIDDLEWARES
 * ================================================
 * Auth & admin guards as reusable procedures.
 */

import { TRPCError } from '@trpc/server';
import { publicProcedure } from './init';
import logger from '../services/logger.service';

export const authedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentification requise' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminToken = process.env.ADMIN_API_TOKEN;
  const provided = ctx.req.headers['x-admin-token'];

  const isAdminByRole = ctx.user?.role === 'admin';
  const isAdminByToken = adminToken && provided === adminToken;

  if (!isAdminByRole && !isAdminByToken) {
    logger.warn(`[tRPC Admin] Tentative d'accès admin refusée (IP: ${ctx.req.ip})`);
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès interdit — privilèges insuffisants' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
