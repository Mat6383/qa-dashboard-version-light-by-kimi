/**
 * ================================================
 * tRPC CLIENT — Frontend
 * ================================================
 * Bridge vers le backend Python (FastAPI + tRPC bridge).
 * Le endpoint /trpc est servi par backend_py/app/routers/trpc.py
 */

import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
// Le type AppRouter est importé directement depuis le backend via le path alias
// `~server/*` défini dans tsconfig.json. Cette approche monorepo garantit la
// cohérence des types tRPC entre le frontend et le backend Node.js.
import type { AppRouter } from '~server/trpc/router';

export function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  // En browser, si VITE_API_URL est '/api', on extrait la base URL
  // pour que tRPC puisse atteindre le backend sur le même host:port
  if (typeof window !== 'undefined') {
    return envUrl.replace('/api', '') || '';
  }
  return envUrl;
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
      headers() {
        const token = localStorage.getItem('qa_dashboard_token') || '';
        return {
          'x-request-id': generateRequestId(),
          Authorization: `Bearer ${token}`,
          'X-Admin-Token': token,
        };
      },
    }),
  ],
});
