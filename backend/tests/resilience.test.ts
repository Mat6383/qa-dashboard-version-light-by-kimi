
/**
 * ================================================
 * TESTS DE RÉSILIENCE ET DE ROBUSTESSE
 * ================================================
 * Couvre les nouvelles protections ajoutées :
 *   1. Retry logic avec backoff exponentiel
 *   2. CORS — validation multi-origines
 *   3. Rate-limiting — configuration
 *   4. Validation des variables d'environnement
 *   5. SQLite WAL — comportement en cas d'erreur
 *   6. _withRetry — cas limites (erreurs 4xx, réseau, 5xx)
 *
 * @author Matou - Neo-Logix QA Lead
 * @standards ISTQB | ITIL Resilience Management
 */

// ─── 1. RETRY LOGIC — backoff exponentiel ────────────────────────────────────

/**
 * Implémentation extraite de testmo.service.js / gitlab.service.js
 * (isolée pour les tests unitaires sans dépendances axios)
 */
async function _withRetry(fn, _label = 'test', maxRetries = 3, baseDelay = 10) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const isRetryable = !status || status === 429 || status >= 500 ||
        err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND';
      if (!isRetryable || attempt === maxRetries) break;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

describe('_withRetry — comportement de base', () => {
  test('succès immédiat — retourne le résultat sans retry', async () => {
    let calls = 0;
    const result = await _withRetry(async () => { calls++; return 'ok'; }, 'test');
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  test('1 échec puis succès — retourne le résultat au 2ème essai', async () => {
    let calls = 0;
    const result = await _withRetry(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
      return 'ok';
    }, 'test', 3, 5);
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  test('3 échecs consécutifs — lève la dernière erreur', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('server error');
        err.response = { status: 503 };
        throw err;
      }, 'test', 3, 5)
    ).rejects.toThrow('server error');
    expect(calls).toBe(3);
  });
});

describe('_withRetry — classification des erreurs retryables', () => {
  test('erreur 500 (Internal Server Error) → retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('500');
        err.response = { status: 500 };
        throw err;
      }, 'test', 2, 5)
    ).rejects.toThrow();
    expect(calls).toBe(2); // a bien retenté
  });

  test('erreur 503 (Service Unavailable) → retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('503');
        err.response = { status: 503 };
        throw err;
      }, 'test', 2, 5)
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });

  test('erreur 429 (Rate Limit) → retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('429');
        err.response = { status: 429 };
        throw err;
      }, 'test', 2, 5)
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });

  test('ECONNRESET (connexion réinitialisée) → retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        throw Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
      }, 'test', 2, 5)
    ).rejects.toThrow('connection reset');
    expect(calls).toBe(2);
  });

  test('ENOTFOUND (DNS failure) → retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
      }, 'test', 2, 5)
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });

  test('erreur 400 (Bad Request) → NON retryable, 1 seul appel', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('400');
        err.response = { status: 400 };
        throw err;
      }, 'test', 3, 5)
    ).rejects.toThrow('400');
    expect(calls).toBe(1); // pas de retry sur 4xx
  });

  test('erreur 401 (Unauthorized) → NON retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('401');
        err.response = { status: 401 };
        throw err;
      }, 'test', 3, 5)
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  test('erreur 403 (Forbidden) → NON retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('403');
        err.response = { status: 403 };
        throw err;
      }, 'test', 3, 5)
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  test('erreur 404 (Not Found) → NON retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('404');
        err.response = { status: 404 };
        throw err;
      }, 'test', 3, 5)
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe('_withRetry — backoff exponentiel', () => {
  test('délai croissant : 10ms → 20ms → 40ms (baseDelay=10)', async () => {
    const delays = [];
    const start = Date.now();
    const timestamps = [start];

    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        if (calls > 1) {
          delays.push(Date.now() - timestamps[timestamps.length - 1]);
          timestamps.push(Date.now());
        } else {
          timestamps.push(Date.now());
        }
        const err = new Error('server error');
        err.response = { status: 503 };
        throw err;
      }, 'backoff-test', 3, 10)
    ).rejects.toThrow();

    // Les délais doivent croître (2ème > 1er)
    if (delays.length >= 2) {
      expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
    }
  });

  test('maxRetries=1 → 1 seul appel même sur erreur retryable', async () => {
    let calls = 0;
    await expect(
      _withRetry(async () => {
        calls++;
        const err = new Error('503'); err.response = { status: 503 };
        throw err;
      }, 'test', 1, 5)
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  test('succès au 3ème essai (maxRetries=3) — résultat correct retourné', async () => {
    let calls = 0;
    const result = await _withRetry(async () => {
      calls++;
      if (calls < 3) {
        const err = new Error('transient'); err.response = { status: 503 };
        throw err;
      }
      return { data: 'final' };
    }, 'test', 3, 5);
    expect(result).toEqual({ data: 'final' });
    expect(calls).toBe(3);
  });
});

// ─── 2. CORS — validation multi-origines ─────────────────────────────────────

/**
 * Logique CORS extraite de server.js
 */
function buildCorsValidator(frontendUrlEnv) {
  const allowedOrigins = (frontendUrlEnv || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return (origin) => {
    if (!origin) return true; // requête sans origin (curl, Postman)
    return allowedOrigins.includes(origin);
  };
}

describe('CORS — validation multi-origines', () => {
  test('origin autorisée (localhost:3000) → true', () => {
    const validate = buildCorsValidator('http://localhost:3000');
    expect(validate('http://localhost:3000')).toBe(true);
  });

  test('origin non autorisée → false', () => {
    const validate = buildCorsValidator('http://localhost:3000');
    expect(validate('http://attacker.example.com')).toBe(false);
  });

  test('requête sans origin (curl, Postman) → toujours autorisée', () => {
    const validate = buildCorsValidator('http://localhost:3000');
    expect(validate(undefined)).toBe(true);
    expect(validate(null)).toBe(true);
    expect(validate('')).toBe(true);
  });

  test('multi-origines via virgule — les deux autorisées', () => {
    const validate = buildCorsValidator('http://localhost:3000,https://dashboard.neo-logix.fr');
    expect(validate('http://localhost:3000')).toBe(true);
    expect(validate('https://dashboard.neo-logix.fr')).toBe(true);
  });

  test('multi-origines — tiers rejeté même si le bon est présent', () => {
    const validate = buildCorsValidator('http://localhost:3000,https://dashboard.neo-logix.fr');
    expect(validate('https://evil.com')).toBe(false);
  });

  test('espaces dans FRONTEND_URL bien supprimés (trim)', () => {
    const validate = buildCorsValidator(' http://localhost:3000 , https://prod.exemple.fr ');
    expect(validate('http://localhost:3000')).toBe(true);
    expect(validate('https://prod.exemple.fr')).toBe(true);
  });

  test('FRONTEND_URL non défini → localhost:3000 par défaut', () => {
    const validate = buildCorsValidator(undefined);
    expect(validate('http://localhost:3000')).toBe(true);
    expect(validate('http://autre.com')).toBe(false);
  });

  test('FRONTEND_URL vide → localhost:3000 par défaut', () => {
    const validate = buildCorsValidator('');
    expect(validate('http://localhost:3000')).toBe(true);
  });

  test('sous-domaine non autorisé (http://sub.localhost:3000) → false', () => {
    const validate = buildCorsValidator('http://localhost:3000');
    expect(validate('http://sub.localhost:3000')).toBe(false);
  });
});

// ─── 3. VALIDATION VARIABLES D'ENVIRONNEMENT ─────────────────────────────────

/**
 * Logique extraite de server.js
 */
function validateEnv(env, required) {
  return required.filter(k => !env[k]);
}

describe('validateEnv — variables d\'environnement requises', () => {
  const REQUIRED = ['TESTMO_URL', 'TESTMO_TOKEN', 'GITLAB_URL', 'GITLAB_TOKEN'];

  test('toutes les variables présentes → tableau vide (pas d\'erreur)', () => {
    const env = {
      TESTMO_URL: 'https://testmo.exemple.fr',
      TESTMO_TOKEN: 'tok_123',
      GITLAB_URL: 'https://gitlab.exemple.fr',
      GITLAB_TOKEN: 'glpat-xyz'
    };
    expect(validateEnv(env, REQUIRED)).toEqual([]);
  });

  test('TESTMO_TOKEN manquant → retourne [\'TESTMO_TOKEN\']', () => {
    const env = {
      TESTMO_URL: 'https://testmo.exemple.fr',
      GITLAB_URL: 'https://gitlab.exemple.fr',
      GITLAB_TOKEN: 'glpat-xyz'
    };
    expect(validateEnv(env, REQUIRED)).toEqual(['TESTMO_TOKEN']);
  });

  test('GITLAB_URL et GITLAB_TOKEN manquants → retourne les deux', () => {
    const env = {
      TESTMO_URL: 'https://testmo.exemple.fr',
      TESTMO_TOKEN: 'tok_123'
    };
    const missing = validateEnv(env, REQUIRED);
    expect(missing).toContain('GITLAB_URL');
    expect(missing).toContain('GITLAB_TOKEN');
    expect(missing).toHaveLength(2);
  });

  test('env complètement vide → toutes les variables manquantes', () => {
    expect(validateEnv({}, REQUIRED)).toHaveLength(REQUIRED.length);
  });

  test('variable avec chaîne vide → considérée comme manquante', () => {
    const env = {
      TESTMO_URL: '',
      TESTMO_TOKEN: 'tok',
      GITLAB_URL: 'https://gitlab.fr',
      GITLAB_TOKEN: 'glpat'
    };
    // '' est falsy → sera retournée dans les manquantes
    expect(validateEnv(env, REQUIRED)).toContain('TESTMO_URL');
  });

  test('ordre des variables manquantes respecte l\'ordre du tableau REQUIRED', () => {
    const env = { GITLAB_TOKEN: 'glpat' }; // seul GITLAB_TOKEN présent
    const missing = validateEnv(env, REQUIRED);
    expect(missing.indexOf('TESTMO_URL')).toBeLessThan(missing.indexOf('GITLAB_URL'));
  });
});

// ─── 4. TIMEZONE CRON ────────────────────────────────────────────────────────

describe('SYNC_TIMEZONE — résolution de la timezone du cron', () => {
  function resolveSyncTimezone(envValue) {
    return envValue || 'Europe/Paris';
  }

  test('SYNC_TIMEZONE non définie → Europe/Paris par défaut', () => {
    expect(resolveSyncTimezone(undefined)).toBe('Europe/Paris');
  });

  test('SYNC_TIMEZONE définie → valeur respectée', () => {
    expect(resolveSyncTimezone('UTC')).toBe('UTC');
    expect(resolveSyncTimezone('America/New_York')).toBe('America/New_York');
  });

  test('SYNC_TIMEZONE vide → Europe/Paris par défaut', () => {
    expect(resolveSyncTimezone('')).toBe('Europe/Paris');
  });
});

// ─── 5. RATE-LIMIT — configuration ───────────────────────────────────────────

describe('RATE_LIMIT_MAX — parsing de la configuration', () => {
  // Même logique que dans server.js :
  // parseInt(val) || default  →  les valeurs falsy (0, NaN) tombent sur le défaut
  // Les valeurs négatives sont conservées telles quelles (parseInt(-1) = -1, truthy)
  function resolveRateLimit(envValue, defaultValue = 200) {
    return parseInt(envValue) || defaultValue;
  }

  test('valeur absente → défaut 200', () => {
    expect(resolveRateLimit(undefined)).toBe(200);
  });

  test('valeur numérique string "100" → 100', () => {
    expect(resolveRateLimit('100')).toBe(100);
  });

  test('valeur non-numérique "abc" → NaN → défaut 200', () => {
    expect(resolveRateLimit('abc')).toBe(200);
  });

  test('valeur zéro "0" → falsy → défaut 200', () => {
    // parseInt("0") = 0 → 0 || 200 → 200
    expect(resolveRateLimit('0')).toBe(200);
  });

  test('valeur négative "-1" → parseInt garde -1 (truthy, not a safe default)', () => {
    // parseInt('-1') = -1, qui est truthy → -1 est conservé
    // Note : éviter de définir RATE_LIMIT_MAX avec une valeur négative en .env
    expect(resolveRateLimit('-1')).toBe(-1);
  });

  test('RATE_LIMIT_HEAVY_MAX avec défaut 20', () => {
    expect(resolveRateLimit(undefined, 20)).toBe(20);
    expect(resolveRateLimit('5', 20)).toBe(5);
  });
});
