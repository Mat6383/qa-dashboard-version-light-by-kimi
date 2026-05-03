import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSyncProgress } from './useSyncProgress';

const API_BASE = 'http://localhost:3001/api';

describe('useSyncProgress', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', API_BASE);
    global.fetch = vi.fn();
  });

  it('démarre avec des logs vides et running=false', () => {
    const { result } = renderHook(() => useSyncProgress('/sync/execute'));
    expect(result.current.logs).toEqual([]);
    expect(result.current.running).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('start appelle fetch et accumule les logs SSE', async () => {
    const encoder = new TextEncoder();
    const chunks = ['data: {"type":"info","message":"Démarrage"}\n\n', 'data: {"type":"done","updated":5}\n\n'];
    let i = 0;

    global.fetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (i >= chunks.length) return Promise.resolve({ done: true });
            const chunk = chunks[i++];
            return Promise.resolve({ done: false, value: encoder.encode(chunk) });
          },
          cancel: vi.fn(),
        }),
      },
    });

    const { result } = renderHook(() => useSyncProgress('/sync/execute'));

    await act(async () => {
      await result.current.start({ projectId: 'p1', iteration: 'R10' });
    });

    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[0].message).toBe('Démarrage');
    expect(result.current.logs[1].type).toBe('done');
  });

  it('empêche le double démarrage (guard running)', async () => {
    global.fetch.mockImplementation(() => new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useSyncProgress('/sync/execute'));

    act(() => {
      result.current.start({});
    });
    expect(result.current.running).toBe(true);

    // Second start should be ignored
    await act(async () => {
      await result.current.start({});
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('stop aborte le fetch et met running à false', async () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useSyncProgress('/sync/execute'));

    act(() => {
      result.current.start({});
    });
    expect(result.current.running).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.running).toBe(false);
  });

  it('gère une erreur HTTP', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Serveur en panne' }),
    });

    const { result } = renderHook(() => useSyncProgress('/sync/execute'));

    await act(async () => {
      await result.current.start({});
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error).toContain('Serveur en panne');
    expect(result.current.running).toBe(false);
  });
});
