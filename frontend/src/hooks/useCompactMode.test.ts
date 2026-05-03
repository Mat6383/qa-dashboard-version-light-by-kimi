import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompactMode } from './useCompactMode';

describe('useCompactMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('compact-mode');
  });

  afterEach(() => {
    localStorage.clear();
    document.body.classList.remove('compact-mode');
  });

  it('initializes as false, no class on body', () => {
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);
    expect(document.body.classList.contains('compact-mode')).toBe(false);
  });

  it('toggle sets true, writes localStorage, adds class', () => {
    const { result } = renderHook(() => useCompactMode());
    act(() => {
      result.current.toggleCompactMode();
    });
    expect(result.current.compactMode).toBe(true);
    expect(localStorage.getItem('testmo_compactMode')).toBe('true');
    expect(document.body.classList.contains('compact-mode')).toBe(true);
  });

  it('reads initial true value from localStorage', () => {
    localStorage.setItem('testmo_compactMode', 'true');
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(true);
    expect(document.body.classList.contains('compact-mode')).toBe(true);
  });

  it('syncs across tabs via storage event', () => {
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'testmo_compactMode',
          newValue: 'true',
        })
      );
    });

    expect(result.current.compactMode).toBe(true);
    expect(document.body.classList.contains('compact-mode')).toBe(true);
  });
});
