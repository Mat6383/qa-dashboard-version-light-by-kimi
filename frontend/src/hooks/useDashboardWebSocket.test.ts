import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardWebSocket } from './useDashboardWebSocket';

describe('useDashboardWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tente WebSocket en premier', () => {
    const wsMock = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    global.WebSocket = vi.fn(function () { return wsMock; }) as any;

    const { result } = renderHook(() =>
      useDashboardWebSocket({ projectId: 1, preprodMilestones: [], prodMilestones: [], enabled: true })
    );

    expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('/ws/dashboard?projectId=1'));
    expect(result.current.connecting).toBe(true);
    expect(result.current.transport).toBeNull();
  });

  it('bascule sur SSE après 3s si WS échoue', async () => {
    global.WebSocket = vi.fn(function () {
      return {
        send: vi.fn(),
        close: vi.fn(),
        readyState: 0,
        set onopen(fn: any) {},
        set onerror(fn: any) {
          setTimeout(() => fn(new Error('fail')), 10);
        },
        set onclose(fn: any) {
          setTimeout(() => fn(), 20);
        },
      };
    }) as any;

    global.EventSource = vi.fn(function () {
      return {
        close: vi.fn(),
        addEventListener: vi.fn(),
      };
    }) as any;

    const preprodMilestones: number[] = [];
    const prodMilestones: number[] = [];

    const { result } = renderHook(() =>
      useDashboardWebSocket({ projectId: 1, preprodMilestones, prodMilestones, enabled: true })
    );

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.transport).toBe('sse');
  });
});
