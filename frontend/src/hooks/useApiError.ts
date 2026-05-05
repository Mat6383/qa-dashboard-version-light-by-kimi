/**
 * ================================================
 * USE API ERROR — Hook de normalisation des erreurs API
 * ================================================
 * Normalise les erreurs Axios, tRPC et génériques pour un affichage
 * cohérent dans l'interface (toasts, banners, champs de formulaire).
 */

import { useCallback } from 'react';
import { AxiosError } from 'axios';
import { useToast } from './useToast';

export interface ApiErrorInfo {
  message: string;
  statusCode?: number;
  isUnauthorized: boolean;
  isNetworkError: boolean;
  isServerError: boolean;
}

function parseError(error: unknown): ApiErrorInfo {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.message ||
      'Erreur de communication avec le serveur';
    return {
      message,
      statusCode: status,
      isUnauthorized: status === 401,
      isNetworkError: !error.response,
      isServerError: status !== undefined && status >= 500,
    };
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as any).message);
    return {
      message: msg || 'Une erreur inattendue est survenue',
      isUnauthorized: msg.includes('UNAUTHORIZED') || msg.includes('401'),
      isNetworkError: msg.includes('fetch') || msg.includes('network'),
      isServerError: msg.includes('500') || msg.includes('INTERNAL_SERVER_ERROR'),
    };
  }

  return {
    message: 'Une erreur inattendue est survenue',
    isUnauthorized: false,
    isNetworkError: false,
    isServerError: false,
  };
}

export function useApiError() {
  const { showToast } = useToast();

  const getErrorInfo = useCallback((error: unknown): ApiErrorInfo => {
    return parseError(error);
  }, []);

  const showError = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const info = parseError(error);
      showToast(fallbackMessage || info.message, 'error');
      return info;
    },
    [showToast]
  );

  const showErrorIfNotCancelled = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const info = parseError(error);
      if (info.message.includes('Canceled') || info.message.includes('Abort')) {
        return info;
      }
      showToast(fallbackMessage || info.message, 'error');
      return info;
    },
    [showToast]
  );

  return { getErrorInfo, showError, showErrorIfNotCancelled };
}
