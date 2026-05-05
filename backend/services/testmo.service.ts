import axios from 'axios';
import logger from './logger.service';
import { instrumentAxios } from './apiTimer.service';
import { _calculatePercentage, aggregateSessions, globalMetrics } from './testmo/helpers';
import {
  getProjectMetrics,
  getEscapeAndDetectionRates,
  getAnnualQualityTrends,
  _getEmptyMetrics,
  _checkSLA,
} from './testmo/metrics';
import {
  getFolders,
  findFolder,
  createFolder,
  getOrCreateFolder,
  deleteFolders,
  getCases,
  findCaseByTag,
  findCaseByName,
  createCase,
  updateCase,
  isCaseEnriched,
} from './testmo/repository';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { withResilience } from '../utils/withResilience';

class TestmoService {
  baseURL: any;
  token: any;
  timeout: number;
  cache: any;
  cacheDuration: number;
  _inFlight: any;
  client: any;
  _tempSessions: any;

  constructor() {
    this.baseURL = process.env.TESTMO_URL;
    this.token = process.env.TESTMO_TOKEN;
    this.timeout = parseInt(process.env.API_TIMEOUT as string) || 10000;

    // Cache pour optimisation LEAN (éviter requêtes redondantes)
    this.cache = new Map();
    this.cacheDuration = parseInt(process.env.CACHE_DURATION as string) || 30000;
    // Déduplication des requêtes en cours (anti-cache-stampede)
    this._inFlight = new Map();

    // Configuration axios
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      timeout: this.timeout,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    instrumentAxios(this.client, 'testmo');

    // Intercepteur pour logging ITIL
    this.client.interceptors.response.use(
      (response: any) => {
        logger.info(`API Success: ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error: any) => {
        logger.error(`API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generic API GET — utilisé par le ReportService
   */
  async apiGet(path: any) {
    const response = await this.client.get(path);
    return response.data;
  }

  /**
   * Récupère les projets disponibles
   * ISTQB: Test Project Scope
   */
  async getProjects() {
    const cacheKey = 'projects';
    return this._withCache(cacheKey, async () => {
      const response = await this._withRetry(
        () =>
          this.client.get('/projects', {
            params: { per_page: 100, sort: 'projects:created_at', order: 'desc' },
          }),
        'getProjects'
      );
      return response.data;
    });
  }

  /**
   * Récupère les runs actifs d'un projet
   * ISTQB Section 5.3: Test Monitoring
   */
  async getProjectRuns(projectId: any, activeOnly = true) {
    const cacheKey = `runs_${projectId}_${activeOnly}`;
    return this._withCache(cacheKey, async () => {
      const response = await this._withRetry(
        () =>
          this.client.get(`/projects/${projectId}/runs`, {
            params: {
              is_closed: activeOnly ? 0 : undefined,
              per_page: 100,
              sort: 'runs:created_at',
              order: 'desc',
              expands: 'users,milestones,configs',
            },
          }),
        'getProjectRuns'
      );
      return response.data;
    });
  }

  /**
   * Récupère les sessions exploratoires d'un projet
   */
  async getProjectSessions(projectId: any, activeOnly = true) {
    const cacheKey = `sessions_${projectId}_${activeOnly}`;
    return this._withCache(cacheKey, async () => {
      const response = await this.client.get(`/projects/${projectId}/sessions`, {
        params: {
          is_closed: activeOnly ? 0 : undefined,
          per_page: 100,
          sort: 'sessions:created_at',
          order: 'desc',
          expands: 'users,milestones',
        },
      });
      return response.data;
    });
  }

  /**
   * Récupère les détails d'un run spécifique
   * ISTQB Section 5.4: Test Reporting
   */
  async getRunDetails(runId: any) {
    try {
      const response = await this.client.get(`/runs/${runId}`, {
        params: {
          expands: 'users,milestones,configs,issues',
        },
      });
      return response.data.result;
    } catch (error: any) {
      throw this._handleError('getRunDetails', error);
    }
  }

  /**
   * Récupère les milestones d'un projet
   */
  async getProjectMilestones(projectId: any) {
    const cacheKey = `milestones_${projectId}`;
    return this._withCache(cacheKey, async () => {
      const response = await this.client.get(`/projects/${projectId}/milestones`, {
        params: {
          per_page: 100,
          sort: 'milestones:created_at',
          order: 'desc',
        },
      });
      return response.data;
    });
  }

  /**
   * Récupère les résultats détaillés d'un run
   * API 2025: Nouveau endpoint /runs/{id}/results
   */
  async getRunResults(runId: any, statusFilter: string | null | undefined = null) {
    try {
      const params: any = {
        per_page: 100,
        expands: 'users,issues',
      };
      if (statusFilter) {
        params.status_id = statusFilter;
      }
      const response = await this.client.get(`/runs/${runId}/results`, { params });
      return response.data;
    } catch (error: any) {
      throw this._handleError('getRunResults', error);
    }
  }

  /**
   * Récupère les runs d'automation
   * ISTQB: Automated Test Execution
   */
  async getAutomationRuns(projectId: any) {
    const cacheKey = `automation_${projectId}`;
    return this._withCache(cacheKey, async () => {
      const response = await this.client.get(`/projects/${projectId}/automation/runs`, {
        params: {
          per_page: 100,
          sort: 'automation_runs:created_at',
          order: 'desc',
          expands: 'users,milestones',
        },
      });
      return response.data;
    });
  }

  // ─── Metrics (extraites dans testmo/metrics.ts) ────────────────────────────

  async getProjectMetrics(projectId: any, preprodMilestones: any = null, prodMilestones: any = null) {
    return getProjectMetrics.call(this, projectId, preprodMilestones, prodMilestones);
  }

  async getEscapeAndDetectionRates(projectId: any, preprodMilestones: any = null, prodMilestones: any = null) {
    return getEscapeAndDetectionRates.call(this, projectId, preprodMilestones, prodMilestones);
  }

  async getAnnualQualityTrends(projectId: any) {
    return getAnnualQualityTrends.call(this, projectId);
  }

  _getEmptyMetrics() {
    return _getEmptyMetrics.call(this);
  }

  _checkSLA(metrics: any) {
    return _checkSLA.call(this, metrics);
  }

  // ─── Cache LEAN ────────────────────────────────────────────────────────────

  _isCacheValid(key: any) {
    if (!this.cache.has(key)) return false;
    const cached = this.cache.get(key);
    const age = Date.now() - cached.timestamp;
    return age < this.cacheDuration;
  }

  _setCache(key: any, data: any) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
    });
  }

  async _withCache(key: any, fetchFn: any) {
    if (this._isCacheValid(key)) {
      return this.cache.get(key).data;
    }
    if (this._inFlight.has(key)) {
      return this._inFlight.get(key);
    }
    const promise = fetchFn().finally(() => {
      this._inFlight.delete(key);
    });
    this._inFlight.set(key, promise);
    const data = await promise;
    this._setCache(key, data);
    return data;
  }

  clearCache() {
    this.cache.clear();
    this._inFlight.clear();
    logger.info('Cache LEAN vidé manuellement');
  }

  // ─── Repository API — Folders & Cases (extrait dans testmo/repository.ts) ──

  async getFolders(projectId: any, parentId = null) {
    return getFolders.call(this, projectId, parentId);
  }

  async findFolder(projectId: any, folderName: any, parentId = null) {
    return findFolder.call(this, projectId, folderName, parentId);
  }

  async createFolder(projectId: any, name: any, parentId = null) {
    return createFolder.call(this, projectId, name, parentId);
  }

  async getOrCreateFolder(projectId: any, name: any, parentId = null) {
    return getOrCreateFolder.call(this, projectId, name, parentId);
  }

  async deleteFolders(projectId: any, folderIds: any) {
    return deleteFolders.call(this, projectId, folderIds);
  }

  async getCases(projectId: any, folderId = null, expands = 'tags') {
    return getCases.call(this, projectId, folderId, expands);
  }

  async findCaseByTag(projectId: any, tag: any, folderId = null) {
    return findCaseByTag.call(this, projectId, tag, folderId);
  }

  async findCaseByName(projectId: any, name: any, folderId = null) {
    return findCaseByName.call(this, projectId, name, folderId);
  }

  async createCase(projectId: any, caseData: any) {
    return createCase.call(this, projectId, caseData);
  }

  async updateCase(projectId: any, caseId: any, caseData: any) {
    return updateCase.call(this, projectId, caseId, caseData);
  }

  isCaseEnriched(testCase: any) {
    return isCaseEnriched.call(this, testCase);
  }

  // ─── Retry & Error Handling ────────────────────────────────────────────────

  async _withRetry(fn: any, label = 'unknown', maxRetries = 3, baseDelay = 500) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const status = err.response?.status;
        const isRetryable =
          !status ||
          status === 429 ||
          status >= 500 ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND';
        if (!isRetryable || attempt === maxRetries) break;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(
          `[Retry] ${label} — tentative ${attempt}/${maxRetries} échouée (${err.message}), nouvel essai dans ${delay}ms`
        );
        await new Promise((r: any) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  async healthCheck(options: any = {}) {
    const { timeout = 5000 } = options;
    const start = Date.now();
    try {
      await this.client.get('/projects', { params: { limit: 1 }, timeout });
      return { ok: true, responseTimeMs: Date.now() - start };
    } catch (error: any) {
      return { ok: false, responseTimeMs: Date.now() - start, error: error.message };
    }
  }

  _handleError(method: any, error: any) {
    const incident = {
      method: method,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString(),
    };
    logger.error(`Testmo Service Error in ${method}:`, incident);
    if (error.response?.status === 401) {
      return new Error('Authentification Testmo échouée - Vérifier le token API');
    } else if (error.response?.status === 403) {
      return new Error('Permissions insuffisantes pour accéder à cette ressource');
    } else if (error.response?.status === 404) {
      return new Error('Ressource Testmo non trouvée');
    } else if (error.response?.status === 429) {
      return new Error('Rate limit atteint - Trop de requêtes API');
    }
    return new Error(`Erreur API Testmo: ${error.message}`);
  }
}

const testmoService = new TestmoService();

const testmoBreaker = new CircuitBreaker({ name: 'testmo', failureThreshold: 5, resetTimeoutMs: 30000 });

function wrapMethod(service: any, methodName: any, breaker: any, options: any) {
  const original = service[methodName].bind(service);
  service[methodName] = (...args: any[]) => withResilience(() => original(...args), breaker, options);
}

wrapMethod(testmoService, 'getProjects', testmoBreaker, {
  label: 'testmo.getProjects',
  maxRetries: 3,
  baseDelayMs: 500,
});
wrapMethod(testmoService, 'getProjectRuns', testmoBreaker, {
  label: 'testmo.getProjectRuns',
  maxRetries: 3,
  baseDelayMs: 500,
});
wrapMethod(testmoService, 'getProjectMetrics', testmoBreaker, {
  label: 'testmo.getProjectMetrics',
  maxRetries: 2,
  baseDelayMs: 800,
});
wrapMethod(testmoService, 'getEscapeAndDetectionRates', testmoBreaker, {
  label: 'testmo.getEscapeAndDetectionRates',
  maxRetries: 2,
  baseDelayMs: 800,
});
wrapMethod(testmoService, 'healthCheck', testmoBreaker, {
  label: 'testmo.healthCheck',
  maxRetries: 2,
  baseDelayMs: 500,
});

export default testmoService;
export { _calculatePercentage, aggregateSessions, globalMetrics, testmoBreaker };
