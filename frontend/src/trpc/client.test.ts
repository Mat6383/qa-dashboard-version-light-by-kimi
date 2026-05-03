import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('trpc/client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getBaseUrl retourne chaîne vide côté client', async () => {
    const { getBaseUrl } = await import('./client');
    expect(getBaseUrl()).toBe('');
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
