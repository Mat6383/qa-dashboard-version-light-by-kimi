/**
 * ================================================
 * CIRCUIT BREAKER — Pattern de résilience
 * ================================================
 * États : CLOSED (normal) → OPEN (panne) → HALF_OPEN (test)
 *
 * @param {Object} options
 * @param {string} options.name — identifiant du breaker
 * @param {number} options.failureThreshold — nb d'erreurs avant ouverture (défaut: 5)
 * @param {number} options.resetTimeoutMs — temps avant half-open (défaut: 30000)
 * @param {number} options.halfOpenMaxCalls — appels autorisés en half-open (défaut: 3)
 */

class CircuitBreaker {
  name: any;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
  state: string;
  failures: number;
  successes: number;
  nextAttempt: number;
  lastFailure: any;

  constructor(options: any = {}) {
    this.name = options.name || 'breaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;

    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.lastFailure = null;
  }

  async execute(fn: any) {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        const remaining = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new Error(
          `CircuitBreaker [${this.name}] is OPEN — retry after ${remaining}s (last: ${this.lastFailure})`
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err: any) {
      this._onFailure(err.message || String(err));
      throw err;
    }
  }

  _onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.halfOpenMaxCalls) {
        this.state = 'CLOSED';
        this.successes = 0;
      }
    }
  }

  _onFailure(message: any) {
    this.failures += 1;
    this.lastFailure = message;
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
}

export { CircuitBreaker };
