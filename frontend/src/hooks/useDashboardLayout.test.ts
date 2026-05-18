import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardLayout, DEFAULT_LAYOUT } from './useDashboardLayout';

const STORAGE_KEY = 'testmo_dashboardLayout_v1';

describe('useDashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns default layout when localStorage is empty', () => {
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
  });

  it('loads layout from localStorage', () => {
    const saved = {
      preprod: ['passRate', 'completionRate', 'failureRate', 'testEfficiency'],
      production: ['escapeRate', 'detectionRate'],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout).toEqual(saved);
  });

  it('falls back to default layout if localStorage is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
  });

  it('falls back to default layout if widget ids are invalid', () => {
    const saved = { preprod: ['badId'], production: ['escapeRate'] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
  });

  it('falls back to default layout if lengths mismatch', () => {
    const saved = { preprod: ['passRate'], production: ['escapeRate'] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
  });

  it('saves layout to localStorage on change', () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.moveWidget('preprod', 0, 1);
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.preprod[0]).toBe(DEFAULT_LAYOUT.preprod[1]);
    expect(saved.preprod[1]).toBe(DEFAULT_LAYOUT.preprod[0]);
  });

  it('resets layout to default', () => {
    const custom = {
      preprod: ['passRate', 'completionRate', 'failureRate', 'testEfficiency'],
      production: ['escapeRate', 'detectionRate'],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.resetLayout();
    });
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
  });

  it('syncs layout across tabs via storage event', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const newLayout = {
      preprod: ['passRate', 'completionRate', 'failureRate', 'testEfficiency'],
      production: ['escapeRate', 'detectionRate'],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(newLayout) })
      );
    });
    expect(result.current.layout).toEqual(newLayout);
  });
});
