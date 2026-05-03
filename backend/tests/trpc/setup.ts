/**
 * ================================================
 * tRPC TEST SETUP
 * ================================================
 */

import { createCallerFactory } from '../../trpc/init';
import { appRouter } from '../../trpc/router';

const defaultCtx = {
  user: null,
  requestId: 'test-request',
  req: {} as any,
  res: {} as any,
};

export function createTestCaller() {
  return createCallerFactory(appRouter)(defaultCtx);
}

export function createAuthedCaller(user: any = { id: 1, role: 'admin' }) {
  return createCallerFactory(appRouter)({
    ...defaultCtx,
    user,
  });
}

export function createAdminCaller() {
  process.env.ADMIN_API_TOKEN = 'test-admin-token';
  return createCallerFactory(appRouter)({
    ...defaultCtx,
    user: { id: 1, role: 'admin' } as any,
    req: {
      headers: { 'x-admin-token': 'test-admin-token' },
      ip: '127.0.0.1',
    } as any,
  });
}

export function createAdminCallerByToken() {
  process.env.ADMIN_API_TOKEN = 'test-admin-token';
  return createCallerFactory(appRouter)({
    ...defaultCtx,
    req: {
      headers: { 'x-admin-token': 'test-admin-token' },
      ip: '127.0.0.1',
    } as any,
  });
}
