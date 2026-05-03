import { useState, useRef, useEffect, useCallback } from 'react';
import { useDashboardSSE } from './useDashboardSSE';
import type { DashboardSSEData } from './useDashboardSSE';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
const WS_FALLBACK_DELAY = 3000;

export interface UseDashboardWebSocketOptions {
  projectId: number;
  preprodMilestones: number[];
  prodMilestones: number[];
  enabled: boolean;
}

export interface DashboardWebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  data: DashboardSSEData | null;
  transport: 'ws' | 'sse' | null;
}

export function useDashboardWebSocket({
  projectId,
  preprodMilestones,
  prodMilestones,
  enabled,
}: UseDashboardWebSocketOptions): DashboardWebSocketState {
  const [transport, setTransport] = useState<'ws' | 'sse' | null>(null);
  const [wsData, setWsData] = useState<DashboardSSEData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disconnectWS = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
    setWsConnecting(false);
  }, []);

  const connectWS = useCallback(() => {
    if (!enabled || !projectId) return;
    disconnectWS();
    setWsConnecting(true);
    setWsError(null);
    setTransport(null);

    const params = new URLSearchParams();
    params.set('projectId', String(projectId));
    if (preprodMilestones?.length) params.set('preprodMilestones', preprodMilestones.join(','));
    if (prodMilestones?.length) params.set('prodMilestones', prodMilestones.join(','));

    const url = `${WS_BASE}/ws/dashboard?${params.toString()}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setWsConnecting(false);
      setTransport('ws');
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'metrics') {
          setWsData(msg.payload);
        } else if (msg.type === 'error') {
          setWsError(msg.payload?.message || 'Erreur WS');
        }
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
      setWsConnecting(false);
      ws.close();
    };

    ws.onclose = () => {
      setWsConnected(false);
      setWsConnecting(false);
    };

    // Fallback SSE après 3s si WS pas connecté
    fallbackTimerRef.current = setTimeout(() => {
      if (!wsConnectedRef.current) {
        disconnectWS();
        setTransport('sse');
      }
    }, WS_FALLBACK_DELAY);
  }, [enabled, projectId, preprodMilestones, prodMilestones, disconnectWS]);

  const wsConnectedRef = useRef(wsConnected);
  useEffect(() => {
    wsConnectedRef.current = wsConnected;
  }, [wsConnected]);

  useEffect(() => {
    if (!enabled) {
      disconnectWS();
      setTransport(null);
      return undefined;
    }
    connectWS();
    return () => disconnectWS();
  }, [connectWS, disconnectWS, enabled]);

  // Fallback SSE
  const sse = useDashboardSSE({
    projectId,
    preprodMilestones,
    prodMilestones,
    enabled: enabled && transport === 'sse',
  });

  if (transport === 'ws') {
    return {
      connected: wsConnected,
      connecting: wsConnecting,
      error: wsError,
      data: wsData,
      transport: 'ws',
    };
  }

  if (transport === 'sse') {
    return {
      connected: sse.connected,
      connecting: sse.connecting,
      error: sse.error,
      data: sse.data,
      transport: 'sse',
    };
  }

  // Phase de tentative WS
  return {
    connected: false,
    connecting: wsConnecting,
    error: null,
    data: null,
    transport: null,
  };
}
