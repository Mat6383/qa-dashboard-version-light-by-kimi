import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../services/api.service', () => ({
  apiClient: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts unauthenticated without token', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('fetches user when token exists in localStorage', async () => {
    localStorage.setItem('qa_dashboard_token', 'fake-jwt');
    mockGet.mockResolvedValue({
      data: { success: true, data: { id: 1, email: 'test@test.com', name: 'Test', role: 'admin' } },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@test.com');
    expect(result.current.isAdmin).toBe(true);
  });

  it('clears auth on 401 response', async () => {
    localStorage.setItem('qa_dashboard_token', 'fake-jwt');
    mockGet.mockRejectedValue({ response: { status: 401 } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('qa_dashboard_token')).toBeNull();
  });

  it('logout calls API and clears state', async () => {
    localStorage.setItem('qa_dashboard_token', 'fake-jwt');
    mockPost.mockResolvedValue({});

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.logout();

    expect(mockPost).toHaveBeenCalledWith('/auth/logout');
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('qa_dashboard_token')).toBeNull();
  });

  it('consumeCallbackToken stores token and fetches user', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { id: 2, email: 'callback@test.com', name: 'Callback', role: 'viewer' } },
    });

    const { result } = renderHook(() => useAuth());

    const ok = result.current.consumeCallbackToken('new-token');
    expect(ok).toBe(true);
    expect(localStorage.getItem('qa_dashboard_token')).toBe('new-token');

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe('callback@test.com');
    expect(result.current.isAdmin).toBe(false);
  });

  it('consumeCallbackToken retourne false si pas de token', () => {
    const { result } = renderHook(() => useAuth());
    const ok = result.current.consumeCallbackToken(null);
    expect(ok).toBe(false);
  });

  it('loginWithGitLab redirige vers GitLab', () => {
    const hrefSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        set href(v) {
          hrefSpy(v);
        },
      },
    });
    const { result } = renderHook(() => useAuth());
    result.current.loginWithGitLab();
    expect(hrefSpy).toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('setToken supprime le token si null', () => {
    localStorage.setItem('qa_dashboard_token', 'tok');
    const { result } = renderHook(() => useAuth());
    result.current.setToken(null);
    expect(localStorage.getItem('qa_dashboard_token')).toBeNull();
  });

  it('fetchMe gère une réponse non-success', async () => {
    localStorage.setItem('qa_dashboard_token', 'fake-jwt');
    mockGet.mockResolvedValue({
      data: { success: false, data: null },
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('fetchMe loggue un warning sur erreur réseau', async () => {
    localStorage.setItem('qa_dashboard_token', 'fake-jwt');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('fetchMe error'), 'Network down');
    warnSpy.mockRestore();
  });
});
