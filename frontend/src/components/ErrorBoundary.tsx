/**
 * ================================================
 * ERROR BOUNDARY — Protection contre les crashes React
 * ================================================
 * Isole les erreurs de rendu pour éviter un écran blanc global.
 * Capture les exceptions via Sentry en production.
 */

import React from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.PROD && Sentry.captureException) {
      Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
    } else if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--text-danger, #dc2626)' }}>Dashboard unavailable</h2>
          <p style={{ marginBottom: '1rem' }}>An unexpected error occurred. Please reload the page.</p>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
            type="button"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
