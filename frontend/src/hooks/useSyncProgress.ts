import { useState, useRef, useCallback, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Hook générique pour consommer un endpoint SSE (streaming) via fetch + ReadableStream.
 * Le backend envoie des lignes `data: <json>\n\n`.
 *
 * @param {string} endpoint - Chemin API (ex: '/sync/status-to-gitlab')
 * @returns {{ logs: Array, running: boolean, error: string|null, start: Function, stop: Function }}
 */
export function useSyncProgress(endpoint) {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const pushLog = useCallback((entry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const start = useCallback(
    async (body = {}) => {
      if (running) return;
      setLogs([]);
      setRunning(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                pushLog(event);
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          pushLog({ type: 'error', message: err.message });
        }
      } finally {
        setRunning(false);
      }
    },
    [endpoint, running, pushLog]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { logs, running, error, start, stop };
}
