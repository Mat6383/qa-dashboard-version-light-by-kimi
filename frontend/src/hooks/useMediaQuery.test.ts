import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile, usePrefersColorScheme } from './useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    listeners = [];
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          query === '(max-width: 768px)'
            ? false
            : query === '(prefers-color-scheme: dark)'
              ? false
              : true,
        media: query,
        addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.push(cb);
        }),
        removeEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
          listeners = listeners.filter((l) => l !== cb);
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial match state', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates when media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((l) => l({ matches: true }));
    });
    expect(result.current).toBe(true);
  });

  it('useIsMobile uses correct query', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('usePrefersColorScheme returns light by default', () => {
    const { result } = renderHook(() => usePrefersColorScheme());
    expect(result.current).toBe('light');
  });
});
