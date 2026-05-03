/**
 * ================================================
 * AUTH CALLBACK — Consomme le token OAuth retourné
 * ================================================
 */

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { consumeCallbackToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('[AuthCallback] OAuth error:', error);
      navigate('/?error=oauth_failed');
      return;
    }

    if (token) {
      const ok = consumeCallbackToken(token);
      if (ok) {
        navigate('/', { replace: true });
        return;
      }
    }

    navigate('/?error=auth_failed');
  }, [searchParams, navigate, consumeCallbackToken]);

  return (
    <div className="loading-container">
      <div className="spinner" />
      <p>Authentification en cours...</p>
    </div>
  );
}
