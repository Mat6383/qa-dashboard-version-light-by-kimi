import { useState, useRef, useEffect, useCallback } from 'react';
import type { DashboardMetrics, QualityRates } from '../types/api.types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MAX_RECONNECT_DELAY = 30000;

export interface UseDashboardSSEOptions {
  projectId: number;
  preprodMilestones: number[];
  prodMilestones: number[];
  enabled: boolean;
}

export interface DashboardSSEData {
  metrics: DashboardMetrics;
  qualityRates: QualityRates | null;
  timestamp: string;
}

export interface DashboardSSEState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  data: DashboardSSEData | null;
}

/**
 * Hook de connexion SSE temps réel pour le dashboard.
 * Utilise EventSource natif (GET endpoint).
 * Auto-reconnect avec backoff exponentiel.
 */
export function useDashboardSSE({
  projectId,
  preprodMilestones,
  prodMilestones,
  enabled,
}: UseDashboardSSEOptions): DashboardSSEState {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSSEData | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !projectId) return;

    disconnect();
    setConnecting(true);
    setError(null);

    const params = new URLSearchParams();
    if (preprodMilestones?.length) {
      params.set('preprodMilestones', preprodMilestones.join(','));
    }
    if (prodMilestones?.length) {
      params.set('prodMilestones', prodMilestones.join(','));
    }

    const url = `${API_BASE}/dashboard/${projectId}/stream?${params.toString()}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    es.addEventListener('metrics', (event) => {
      try {
        const payload = JSON.parse(event.data) as DashboardSSEData;
        setData(payload);
      } catch {
        /* ignore parse errors */
      }
    });

    es.addEventListener('error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { message?: string };
        setError(payload.message || 'Erreur SSE');
      } catch {
        setError('Erreur SSE');
      }
    });

    es.onerror = () => {
      setConnected(false);
      setConnecting(false);
      es.close();

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(
        5000 * Math.pow(2, reconnectAttemptsRef.current - 1),
        MAX_RECONNECT_DELAY
      );
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [enabled, projectId, preprodMilestones, prodMilestones, disconnect]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return undefined;
    }
    connect();
    return () => disconnect();
  }, [connect, disconnect, enabled]);

  return { connected, connecting, error, data };
}
