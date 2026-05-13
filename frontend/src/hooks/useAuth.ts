/**
 * ================================================
 * USE AUTH — Hook de gestion de l'authentification
 * ================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.service';

/** @deprecated Legacy token key — kept only to clean up old localStorage entries. */
const TOKEN_KEY = 'qa_dashboard_token';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      // Backend Python retourne l'objet user directement (pas de wrapper {success,data})
      const userData = response.data?.data ?? response.data;
      if (userData && userData.id) {
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        // Try to refresh the access token using the refresh_token cookie
        try {
          await apiClient.post('/auth/refresh');
          const retry = await apiClient.get('/auth/me');
          const userData = retry.data?.data ?? retry.data;
          if (userData && userData.id) {
            setUser(userData);
            setLoading(false);
            return;
          }
        } catch (refreshErr) {
          /* refresh failed, fall through to logout */
        }
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
    fetchMe();
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

  const isAdmin = user?.role === 'admin';

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    loginWithGitLab,
    logout,
    refreshUser: fetchMe,
  };
}
