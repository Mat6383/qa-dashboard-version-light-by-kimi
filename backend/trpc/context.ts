/**
 * ================================================
 * tRPC CONTEXT
 * ================================================
 * Build tRPC context from Express request.
 */

import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwtService from '../services/auth/jwt.service';
import usersService from '../services/users.service';
import logger from '../services/logger.service';

export interface User {
  id: number;
  gitlab_id: number;
  email: string;
  name: string;
  avatar: string | null;
  role: 'admin' | 'viewer';
  created_at: string;
  last_login: string;
}

export interface Context {
  user: User | null;
  requestId: string;
  req: CreateExpressContextOptions['req'];
  res: CreateExpressContextOptions['res'];
}

function extractToken(req: CreateExpressContextOptions['req']): string | null {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.slice(7);
  }
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

export function createTRPCContext({ req, res }: CreateExpressContextOptions): Context {
  const requestId = (req.headers['x-request-id'] as string) || `trpc-${Date.now()}`;
  const token = extractToken(req);
  let user: User | null = null;

  if (token) {
    const payload = jwtService.verify(token);
    if (payload && typeof payload === 'object' && 'sub' in payload) {
      const found = usersService.findById((payload as any).sub);
      if (found) {
        user = found as User;
      }
    }
  }

  // Fallback X-Admin-Token pour tests e2e
  if (!user) {
    const adminToken = process.env.ADMIN_API_TOKEN;
    const provided = req.headers['x-admin-token'];
    if (adminToken && provided && provided === adminToken) {
      user = {
        id: 0,
        gitlab_id: 0,
        email: 'admin@system',
        name: 'Admin',
        avatar: null,
        role: 'admin',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      } as User;
    }
  }

  return { user, requestId, req, res };
}
