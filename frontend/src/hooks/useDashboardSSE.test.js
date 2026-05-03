import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardSSE } from './useDashboardSSE';

const EMPTY_PREPROD = [];
const EMPTY_PROD = [];
const MILESTONES_PREPROD = [10, 20];
const MILESTONES_PROD = [30];

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = {};
    MockEventSource.instances.push(this);
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  dispatch(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((h) => h({ data: typeof data === 'string' ? data : JSON.stringify(data) }));
    }
  }

  triggerOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  triggerError() {
    this.readyState = 2;
    if (this.onerror) this.onerror();
  }

  close() {
    this.readyState = 2;
  }
}

MockEventSource.instances = [];
MockEventSource.CONNECTING = 0;
MockEventSource.OPEN = 1;
MockEventSource.CLOSED = 2;

function getLastES() {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

describe('useDashboardSSE', () => {
  let originalEventSource;

  beforeEach(() => {
    originalEventSource = global.EventSource;
    global.EventSource = MockEventSource;
    MockEventSource.instances = [];
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
  });

  it('ne se connecte pas quand enabled est false', () => {
    renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: false,
      })
    );
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('crée une connexion EventSource quand enabled est true', () => {
    renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: true,
      })
    );
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    expect(getLastES().url).toContain('/dashboard/1/stream');
  });

  it('ajoute les milestones dans l URL', () => {
    renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: MILESTONES_PREPROD,
        prodMilestones: MILESTONES_PROD,
        enabled: true,
      })
    );
    const url = getLastES().url;
    expect(url).toContain('preprodMilestones=10%2C20');
    expect(url).toContain('prodMilestones=30');
  });

  it('passe à connected quand onopen est déclenché', () => {
    const { result } = renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: true,
      })
    );

    act(() => {
      getLastES().triggerOpen();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.connecting).toBe(false);
  });

  it('met à jour data quand un événement metrics est reçu', () => {
    const { result } = renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: true,
      })
    );

    act(() => {
      getLastES().dispatch('metrics', {
        metrics: { passRate: 95 },
        qualityRates: { escapeRate: 2 },
        timestamp: '2026-04-28T10:00:00Z',
      });
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data.metrics.passRate).toBe(95);
  });

  it('met à jour error quand un événement error est reçu', () => {
    const { result } = renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: true,
      })
    );

    act(() => {
      getLastES().dispatch('error', { message: 'Testmo indisponible' });
    });

    expect(result.current.error).toBe('Testmo indisponible');
  });

  it('tente de reconnecter après une erreur avec backoff', async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: true,
      })
    );

    const countBefore = MockEventSource.instances.length;
    act(() => {
      getLastES().triggerError();
    });

    expect(MockEventSource.instances.length).toBe(countBefore);

    await vi.advanceTimersByTimeAsync(5000);
    expect(MockEventSource.instances.length).toBe(countBefore + 1);

    vi.useRealTimers();
  });

  it('ferme la connexion au démontage', () => {
    const { unmount } = renderHook(() =>
      useDashboardSSE({
        projectId: 1,
        preprodMilestones: EMPTY_PREPROD,
        prodMilestones: EMPTY_PROD,
        enabled: true,
      })
    );

    const es = getLastES();
    const closeSpy = vi.spyOn(es, 'close');
    act(() => {
      unmount();
    });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('change de connexion quand projectId change', () => {
    const { rerender } = renderHook(
      ({ projectId }) =>
        useDashboardSSE({
          projectId,
          preprodMilestones: EMPTY_PREPROD,
          prodMilestones: EMPTY_PROD,
          enabled: true,
        }),
      { initialProps: { projectId: 1 } }
    );

    expect(getLastES().url).toContain('/dashboard/1/stream');

    rerender({ projectId: 2 });
    expect(getLastES().url).toContain('/dashboard/2/stream');
  });
});
