import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoRefresh } from './useAutoRefresh';

describe('useAutoRefresh', () => {
  const mocks = {
    checkBackendHealth: vi.fn(),
    loadProjects: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mocks).forEach((m) => {
      if (typeof m === 'function') m.mockReset();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appelle checkBackendHealth et loadProjects au montage', () => {
    renderHook(() =>
      useAutoRefresh({
        checkBackendHealth: mocks.checkBackendHealth,
        loadProjects: mocks.loadProjects,
      })
    );
    expect(mocks.checkBackendHealth).toHaveBeenCalledTimes(1);
    expect(mocks.loadProjects).toHaveBeenCalledTimes(1);
  });

  it('ne rappelle pas les fonctions au re-render', () => {
    const { rerender } = renderHook(() =>
      useAutoRefresh({
        checkBackendHealth: mocks.checkBackendHealth,
        loadProjects: mocks.loadProjects,
      })
    );

    rerender();
    expect(mocks.checkBackendHealth).toHaveBeenCalledTimes(1);
    expect(mocks.loadProjects).toHaveBeenCalledTimes(1);
  });
});
