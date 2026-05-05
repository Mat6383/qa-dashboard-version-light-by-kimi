import axios, { AxiosInstance, AxiosResponse } from 'axios';
import https from 'https';
import logger from '../logger.service';
import { instrumentAxios } from '../apiTimer.service';

export interface GitlabRestClientConfig {
  baseURL: string;
  token: string;
  writeToken?: string;
  projectId?: string;
  verifySsl?: boolean;
  timeout?: number;
  apiDelay?: number;
}

export class GitlabRestClient {
  baseURL: string;
  token: string;
  writeToken: string;
  projectId: string | null;
  verifySsl: boolean;
  timeout: number;
  apiDelay: number;
  client: AxiosInstance;
  writeClient: AxiosInstance;

  constructor(config: GitlabRestClientConfig) {
    this.baseURL = config.baseURL;
    this.token = config.token;
    this.writeToken = config.writeToken || config.token;
    this.projectId = config.projectId || null;
    this.verifySsl = config.verifySsl !== false;
    this.timeout = config.timeout || 10000;
    this.apiDelay = config.apiDelay || 300;

    const httpsAgent = this.verifySsl === false ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      ...(httpsAgent && { httpsAgent }),
    });

    this.writeClient = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.writeToken,
        'Content-Type': 'application/json',
      },
      ...(httpsAgent && { httpsAgent }),
    });

    instrumentAxios(this.client, 'gitlab');
    instrumentAxios(this.writeClient, 'gitlab-write');

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.info(`GitLab API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`GitLab API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  _delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.apiDelay));
  }

  async _withRetry<T>(fn: () => Promise<T>, label = 'unknown', maxRetries = 3, baseDelay = 600): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        const axiosErr = err as { response?: { status: number }; code?: string; message?: string };
        const status = axiosErr.response?.status;
        const isRetryable =
          !status ||
          status === 429 ||
          status >= 500 ||
          axiosErr.code === 'ECONNRESET' ||
          axiosErr.code === 'ETIMEDOUT' ||
          axiosErr.code === 'ENOTFOUND';
        if (!isRetryable || attempt === maxRetries) break;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(
          `[Retry] GitLab.${label} — tentative ${attempt}/${maxRetries} (${axiosErr.message}), nouvel essai dans ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  async _getPaginated(url: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
    const results: unknown[] = [];
    params.per_page = 100;
    params.page = 1;

    while (true) {
      const resp = await this._withRetry(() => this.client.get(url, { params }), `_getPaginated(${url})`);
      const data = resp.data as unknown[];
      if (!data || data.length === 0) break;
      results.push(...data);

      const nextPage = resp.headers['x-next-page'];
      if (!nextPage) break;
      params.page = parseInt(nextPage as string);
      await this._delay();
    }

    return results;
  }

  async healthCheck(options: { timeout?: number } = {}): Promise<{ ok: boolean; responseTimeMs: number; error?: string }> {
    const { timeout = 5000 } = options;
    const start = Date.now();
    try {
      const url = this.projectId ? `/projects/${this.projectId}` : '/projects';
      const params = this.projectId ? {} : { per_page: 1 };
      await this.client.get(url, { params, timeout });
      return { ok: true, responseTimeMs: Date.now() - start };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, responseTimeMs: Date.now() - start, error: msg };
    }
  }

  static fromConfig(config: GitlabRestClientConfig): GitlabRestClient {
    return new GitlabRestClient(config);
  }
}
