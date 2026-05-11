import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('trpc/client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getTrpcBaseUrl retourne chaîne vide côté client', async () => {
    const { getTrpcBaseUrl } = await import('../services/http.config');
    expect(getTrpcBaseUrl()).toBe('');
  });

  it('generateRequestId retourne un string formaté', async () => {
    const { generateRequestId } = await import('./client');
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('trpcClient est défini après import', async () => {
    const { trpcClient } = await import('./client');
    expect(trpcClient).toBeDefined();
  });
});
