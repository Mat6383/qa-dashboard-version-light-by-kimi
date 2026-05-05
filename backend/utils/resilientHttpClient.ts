import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CircuitBreaker } from './circuitBreaker';
import { withResilience } from './withResilience';
import { instrumentAxios } from '../services/apiTimer.service';
import logger from '../services/logger.service';

export interface ResilientHttpClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  httpsAgent?: unknown;
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  instrumentName?: string;
}

/**
 * ResilientHttpClient — Client HTTP avec retry exponentiel et circuit breaker intégrés.
 *
 * Élimine la duplication de la logique de résilience présente dans
 * gitlabConnector, gitlabRestClient, testmoService, etc.
 */
export class ResilientHttpClient {
  private client: AxiosInstance;
  private breaker: CircuitBreaker;
  private name: string;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(config: ResilientHttpClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: config.headers,
      ...(config.httpsAgent ? { httpsAgent: config.httpsAgent } : {}),
    });
    this.name = config.name;
    this.maxRetries = config.maxRetries || 3;
    this.baseDelayMs = config.baseDelayMs || 500;

    this.breaker = new CircuitBreaker({
      name: config.name,
      failureThreshold: config.failureThreshold || 5,
      resetTimeoutMs: config.resetTimeoutMs || 30000,
    });

    if (config.instrumentName) {
      instrumentAxios(this.client, config.instrumentName);
    }

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.info(`${this.name} API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`${this.name} API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return withResilience(() => this.client.get(url, config), this.breaker, {
      label: `${this.name}.get`,
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
    });
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return withResilience(() => this.client.post(url, data, config), this.breaker, {
      label: `${this.name}.post`,
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
    });
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return withResilience(() => this.client.put(url, data, config), this.breaker, {
      label: `${this.name}.put`,
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
    });
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return withResilience(() => this.client.delete(url, config), this.breaker, {
      label: `${this.name}.delete`,
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
    });
  }

  get circuitBreakerStatus() {
    return this.breaker.getStatus();
  }
}
