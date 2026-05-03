/**
 * ================================================
 * TESTMO DASHBOARD - Entry Point
 * ================================================
 * Point d'entrée principal de l'application React
 *
 * @author Matou - Neo-Logix QA Lead
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import * as Sentry from '@sentry/react';
import { queryClient } from './lib/queryClient';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '2.0.0',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
  });
}
import { ThemeProvider } from './contexts/ThemeContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext';
import { TRPCProvider } from './trpc/provider';
import './i18n';
import './styles/tokens.css';
import App from './App';

// Enregistrement du Service Worker pour PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

// Montage de l'application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TRPCProvider>
          <ThemeProvider>
            <PreferencesProvider>
              <DashboardProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </DashboardProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </TRPCProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
