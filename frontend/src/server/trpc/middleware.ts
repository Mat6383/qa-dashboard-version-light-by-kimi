/**
 * ================================================
 * tRPC MIDDLEWARES
 * ================================================
 * Auth & admin guards as reusable procedures.
 */

import { timingSafeEqual } from 'crypto';
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

function safeTimingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminToken = process.env.ADMIN_API_TOKEN;
  const provided = ctx.req.headers['x-admin-token'];

  const isAdminByRole = ctx.user?.role === 'admin';
  const isAdminByToken =
    !!adminToken &&
    typeof provided === 'string' &&
    safeTimingEqual(adminToken, provided);

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
