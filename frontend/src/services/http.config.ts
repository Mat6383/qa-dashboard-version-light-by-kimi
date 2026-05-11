/**
 * ================================================
 * HTTP CONFIG — Centralized credential & base URL
 * ================================================
 * Single source of truth for all HTTP client configurations
 * that need cross-origin credentials (cookies).
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const API_TIMEOUT = 30000;

export const axiosCredentials = { withCredentials: true } as const;

export const fetchCredentials = { credentials: 'include' as RequestCredentials };

export const eventSourceCredentials = { withCredentials: true } as const;

/**
 * Base URL for tRPC (strips `/api` suffix because the endpoint is `/trpc`).
 */
export function getTrpcBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  if (typeof window !== 'undefined') {
    return envUrl.replace('/api', '') || '';
  }
  return envUrl;
}
