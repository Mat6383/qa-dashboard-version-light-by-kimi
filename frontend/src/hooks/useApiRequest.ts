import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../services/api.service';
import type { AxiosRequestConfig } from 'axios';

export function useApiRequest<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const execute = useCallback(async (url: string, config?: AxiosRequestConfig) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get(url, { ...config, signal: controller.signal });
      if (requestId === requestIdRef.current) {
        setData(res.data);
        return res.data as T;
      }
    } catch (err: any) {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        const msg = err?.response?.data?.detail || err?.message || 'Erreur de chargement';
        setError(msg);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
