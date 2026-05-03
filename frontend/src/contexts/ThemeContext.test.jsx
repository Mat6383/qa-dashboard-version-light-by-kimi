import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, ThemeContext } from './ThemeContext';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

function mockMatchMedia(matches) {
  const listeners = [];
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((event, cb) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => {
      mql.media = query;
      return mql;
    }),
  });
  return mql;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(false);
  });

  it('initializes dark mode from localStorage', () => {
    localStorage.setItem('testmo_darkMode', 'true');
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    expect(result.current.isDark).toBe(true);
  });

  it('defaults to system light mode when localStorage is empty', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    expect(result.current.isDark).toBe(false);
  });

  it('defaults to system dark mode when localStorage is empty', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    expect(result.current.isDark).toBe(true);
  });

  it('toggles dark mode', () => {
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    act(() => result.current.toggleDark());
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem('testmo_darkMode')).toBe('true');
  });

  it('follows system preference changes when no manual override', () => {
    const mql = mockMatchMedia(false);

    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    expect(result.current.isDark).toBe(false);

    const listeners = mql.addEventListener.mock.calls.map((call) => call[1]);
    act(() => listeners.forEach((cb) => cb({ matches: true })));
    expect(result.current.isDark).toBe(true);

    act(() => listeners.forEach((cb) => cb({ matches: false })));
    expect(result.current.isDark).toBe(false);
  });

  it('ignores system preference changes after manual toggle', () => {
    const mql = mockMatchMedia(false);

    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    act(() => result.current.toggleDark()); // manual override -> true
    expect(result.current.isDark).toBe(true);

    const listeners = mql.addEventListener.mock.calls.map((call) => call[1]);
    act(() => listeners.forEach((cb) => cb({ matches: false })));
    expect(result.current.isDark).toBe(true); // still true because manual override
  });

  it('initializes tv mode from localStorage', () => {
    localStorage.setItem('testmo_tvMode', 'false');
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    expect(result.current.tvMode).toBe(false);
  });

  it('defaults tv mode to true when localStorage is empty', () => {
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    expect(result.current.tvMode).toBe(true);
  });

  it('toggles tv mode', () => {
    const { result } = renderHook(() => React.useContext(ThemeContext), { wrapper });
    act(() => result.current.toggleTv());
    expect(result.current.tvMode).toBe(false);
    expect(localStorage.getItem('testmo_tvMode')).toBe('false');
  });
});
