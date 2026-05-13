/**
 * ================================================
 * tRPC CLIENT — Frontend
 * ================================================
 * Bridge vers le backend Python (FastAPI + tRPC bridge).
 * Le endpoint /trpc est servi par backend_py/app/routers/trpc.py
 */

import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
// Le type AppRouter est importé depuis le legacy Node.js server/.
// Ce dossier est type-only (voir server/README.md). Le runtime tRPC
// est servi par backend_py/app/routers/trpc.py.
import type { AppRouter } from '~server/trpc/router';
import { getTrpcBaseUrl, fetchCredentials } from '../services/http.config';

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getTrpcBaseUrl()}/trpc`,
      fetch: (input, init) => fetch(input, { ...init, ...fetchCredentials }),
      headers() {
        const token = localStorage.getItem('qa_dashboard_token');
        const headers: Record<string, string> = {
          'x-request-id': generateRequestId(),
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        return headers;
      },
    }),
  ],
});
