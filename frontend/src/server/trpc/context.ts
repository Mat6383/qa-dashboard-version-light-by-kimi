/**
 * ================================================
 * tRPC CONTEXT
 * ================================================
 * Type-only context for frontend tRPC client typing.
 */

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

interface MinimalReq {
  headers: Record<string, any>;
  ip?: string;
  cookies?: Record<string, any>;
}

interface MinimalRes {
  // stub
}

export interface Context {
  user: User | null;
  requestId: string;
  req: MinimalReq;
  res: MinimalRes;
}

export function createTRPCContext({ req, res }: any): Context {
  return { user: null, requestId: '', req, res };
}
