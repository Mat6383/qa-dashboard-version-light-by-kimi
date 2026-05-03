import { CircuitBreaker } from '../../utils/circuitBreaker';
/**
 * Tests unitaires du Circuit Breaker
 */


describe('CircuitBreaker', () => {
  it('passe en OPEN après N échecs consécutifs', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 3, resetTimeoutMs: 10000 });

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        /* ignore */
      }
    }

    expect(breaker.state).toBe('OPEN');
    expect(breaker.failures).toBe(3);
  });

  it('retourne une erreur immédiate quand OPEN', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeoutMs: 10000 });

    try {
      await breaker.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      /* ignore */
    }

    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('CircuitBreaker [test] is OPEN');
  });

  it('passe en HALF_OPEN après le timeout', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeoutMs: 50 });

    try {
      await breaker.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      /* ignore */
    }

    expect(breaker.state).toBe('OPEN');
    await new Promise((r) => setTimeout(r, 60));

    await breaker.execute(async () => 'ok');
    expect(breaker.state).toBe('HALF_OPEN');
  });

  it('referme quand HALF_OPEN réussit 3 fois', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeoutMs: 50, halfOpenMaxCalls: 3 });

    try {
      await breaker.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      /* ignore */
    }

    await new Promise((r) => setTimeout(r, 60));

    await breaker.execute(async () => 'ok');
    await breaker.execute(async () => 'ok');
    await breaker.execute(async () => 'ok');

    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failures).toBe(0);
  });

  it('retourne le statut complet', () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 5, resetTimeoutMs: 30000 });
    expect(breaker.getStatus()).toEqual({
      name: 'test',
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailure: null,
      nextAttempt: null,
    });
  });
});
