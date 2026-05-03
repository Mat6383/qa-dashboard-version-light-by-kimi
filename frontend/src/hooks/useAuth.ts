/**
 * ================================================
 * USE AUTH — Hook de gestion de l'authentification
 * ================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.service';

const TOKEN_KEY = 'qa_dashboard_token';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
      } else {
        console.warn('[useAuth] fetchMe error:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const loginWithGitLab = useCallback(() => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/gitlab`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      /* silencieux */
    }
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }, []);

  const consumeCallbackToken = useCallback(
    (token) => {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        fetchMe();
        return true;
      }
      return false;
    },
    [fetchMe]
  );

  const isAdmin = user?.role === 'admin';

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    loginWithGitLab,
    logout,
    consumeCallbackToken,
    setToken,
    refreshUser: fetchMe,
  };
}
