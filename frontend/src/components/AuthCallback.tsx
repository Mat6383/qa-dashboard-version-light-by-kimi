/**
 * ================================================
 * AUTH CALLBACK — Consomme le cookie de session
 * ================================================
 */

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      console.error('[AuthCallback] OAuth error:', error);
      navigate('/?error=oauth_failed');
      return;
    }

    // Cookie-based auth: backend set an HttpOnly cookie before redirecting here
    refreshUser()
      .then(() => navigate('/', { replace: true }))
      .catch(() => navigate('/?error=auth_failed', { replace: true }));
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="loading-container">
      <div className="spinner" />
      <p>Authentification en cours...</p>
    </div>
  );
}
