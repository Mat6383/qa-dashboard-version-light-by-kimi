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

// NOTE: createTRPCContext is intentionally not implemented.
// The real tRPC runtime lives in backend_py/app/routers/trpc.py.
// This file is type-only; the SSR context would require decoding
// the JWT from the incoming request headers.
export function createTRPCContext(_opts: unknown): Context {
  throw new Error('createTRPCContext is not implemented — tRPC SSR is stub-only');
}
