import logger from './logger.service';

const MAX_SAMPLES = 100;
const stats = new Map(); // name → { times: number[], totalCalls, errors }

function _ensureStats(name: any) {
  if (!stats.has(name)) {
    stats.set(name, { times: [], totalCalls: 0, errors: 0 });
  }
  return stats.get(name);
}

function _recordTime(name: any, durationMs: any, error = false) {
  const s = _ensureStats(name);
  s.totalCalls += 1;
  if (error) {
    s.errors += 1;
  } else {
    s.times.push(durationMs);
    if (s.times.length > MAX_SAMPLES) s.times.shift();
  }
}

function _avg(arr: any) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a: any, b: any) => a + b, 0) / arr.length);
}

function _p95(arr: any) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a: any, b: any) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Ajoute des interceptors request/response sur une instance Axios
 * pour mesurer automatiquement les temps de réponse.
 * @param {import('axios').AxiosInstance} client
 * @param {string} name - Nom de l'API ('testmo' | 'gitlab')
 */
function instrumentAxios(client: any, name: any) {
  client.interceptors.request.use((config: any) => {
    config._startTime = Date.now();
    return config;
  });

  client.interceptors.response.use(
    (response: any) => {
      const start = response.config._startTime;
      if (start) {
        const duration = Date.now() - start;
        _recordTime(name, duration);
        // Log lent (> 5 s)
        if (duration > 5000) {
          logger.warn(
            `API ${name} lente — ${response.config.method?.toUpperCase()} ${response.config.url} : ${duration}ms`
          );
        }
      }
      return response;
    },
    (error: any) => {
      const config = error.config;
      if (config && config._startTime) {
        const duration = Date.now() - config._startTime;
        _recordTime(name, duration, true);
        logger.warn(
          `API ${name} erreur — ${config.method?.toUpperCase()} ${config.url} : ${duration}ms — ${error.message}`
        );
      }
      return Promise.reject(error);
    }
  );
}

/**
 * Retourne les statistiques actuelles de temps de réponse.
 */
function getStats() {
  const result: any = {};
  for (const [name, s] of stats) {
    result[name] = {
      totalCalls: s.totalCalls,
      errors: s.errors,
      avgResponseTimeMs: _avg(s.times),
      p95ResponseTimeMs: _p95(s.times),
      lastCallsCount: s.times.length,
    };
  }
  return result;
}

export { instrumentAxios, getStats };
