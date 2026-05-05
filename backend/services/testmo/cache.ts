import logger from '../logger.service';

/**
 * Cache LEAN avec déduplication des requêtes en cours (anti-stampede).
 */
export class TestmoCache {
  cache: Map<string, any>;
  cacheDuration: number;
  _inFlight: Map<string, Promise<any>>;

  constructor(cacheDuration: number) {
    this.cache = new Map();
    this.cacheDuration = cacheDuration;
    this._inFlight = new Map();
  }

  isValid(key: string) {
    if (!this.cache.has(key)) return false;
    const cached = this.cache.get(key);
    const age = Date.now() - cached.timestamp;
    return age < this.cacheDuration;
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string) {
    return this.cache.get(key)?.data;
  }

  async withCache(key: string, fetchFn: () => Promise<any>) {
    if (this.isValid(key)) {
      return this.get(key);
    }
    if (this._inFlight.has(key)) {
      return this._inFlight.get(key);
    }
    const promise = fetchFn().finally(() => {
      this._inFlight.delete(key);
    });
    this._inFlight.set(key, promise);
    const data = await promise;
    this.set(key, data);
    return data;
  }

  clear() {
    this.cache.clear();
    this._inFlight.clear();
    logger.info('Cache LEAN vidé manuellement');
  }
}
