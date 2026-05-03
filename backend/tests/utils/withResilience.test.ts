import { withResilience, isRetryable } from '../../utils/withResilience';
import { CircuitBreaker } from '../../utils/circuitBreaker';
/**
 * Tests unitaires de withResilience
 */


describe('withResilience', () => {
  it('retourne le résultat en cas de succès', async () => {
    const breaker = new CircuitBreaker({ name: 'test' });
    const result = await withResilience(async () => 'ok', breaker, { label: 'test' });
    expect(result).toBe('ok');
  });

  it('retry sur erreur retryable puis succès', async () => {
    const breaker = new CircuitBreaker({ name: 'test' });
    let attempts = 0;
    const result = await withResilience(
      async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('timeout');
          err.code = 'ETIMEDOUT';
          throw err;
        }
        return 'ok';
      },
      breaker,
      { label: 'test', maxRetries: 3, baseDelayMs: 10 }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('ne retry pas sur erreur 4xx (sauf 429)', async () => {
    const breaker = new CircuitBreaker({ name: 'test' });
    let attempts = 0;
    const err = new Error('Not found');
    err.response = { status: 404 };

    await expect(
      withResilience(
        async () => {
          attempts++;
          throw err;
        },
        breaker,
        { label: 'test', maxRetries: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow('Not found');

    expect(attempts).toBe(1);
  });

  it('ouvre le circuit breaker après trop d échecs', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 2, resetTimeoutMs: 10000 });
    const err = new Error('fail');
    err.code = 'ECONNRESET';

    for (let i = 0; i < 3; i++) {
      try {
        await withResilience(
          async () => {
            throw err;
          },
          breaker,
          { label: 'test', maxRetries: 0 }
        );
      } catch {
        /* ignore */
      }
    }

    expect(breaker.state).toBe('OPEN');
  });
});

describe('isRetryable', () => {
  it('retourne true pour 429', () => {
    expect(isRetryable({ response: { status: 429 } })).toBe(true);
  });

  it('retourne true pour 500', () => {
    expect(isRetryable({ response: { status: 500 } })).toBe(true);
  });

  it('retourne false pour 404', () => {
    expect(isRetryable({ response: { status: 404 } })).toBe(false);
  });

  it('retourne true pour ECONNRESET', () => {
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  });
});
