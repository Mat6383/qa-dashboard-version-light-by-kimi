/**
 * ================================================
 * API SERVICE - Frontend (TypeScript)
 * ================================================
 * Service pour communiquer avec le backend Express
 *
 * @author Matou - Neo-Logix QA Lead
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Project,
  DashboardMetrics,
  QualityRates,
  MilestoneListResponse,
  SyncProject,
  SyncIteration,
  SyncPreviewResult,
  SyncHistoryEntry,
  CrosstestIssue,
  CrosstestComment,
  AutoSyncConfig,
  NotificationSettings,
  AuditLog,
  AuditLogListResponse,
  CircuitBreakerState,
  AnomalyItem,
  FeatureFlagAdminResponse,
  FeatureFlag,
  FeatureFlagCreateInput,
  FeatureFlagUpdateInput,
  ApiResponse,
  ApiErrorResponse,
  MultiProjectSummaryItem,
} from '../types/api.types';

// Configuration axios
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_TIMEOUT = 30000; // 30 secondes pour compenser le chargement des multiples jalons

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers['x-request-id'] = config.headers['x-request-id'] || generateRequestId();
    const token = localStorage.getItem('qa_dashboard_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // eslint-disable-next-line no-console
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    // eslint-disable-next-line no-console
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // eslint-disable-next-line no-console
    console.log(`[API] Response:`, response.status, response.data);
    return response;
  },
  (error: AxiosError) => {
    if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    console.error('[API] Response error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * API Service
 */
export { apiClient };

export interface ReportGenerateParams {
  projectId: number;
  milestoneId?: number;
  runIds?: (number | string)[];
  formats?: { html?: boolean; pptx?: boolean };
  recommendations?: string[];
  complement?: string;
}

export interface ExportMilestones {
  preprod: number[];
  prod: number[];
}

function handleError(operation: string, error: AxiosError | Error): Error {
  const axiosError = error as AxiosError<{ error?: string }>;
  const errorMessage = axiosError.response?.data?.error || error.message;
  console.error(`[API Service] ${operation} failed:`, errorMessage);
  return new Error(`${operation}: ${errorMessage}`);
}

async function apiCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw handleError(operation, error as AxiosError | Error);
  }
}

const apiService = {
  /**
   * Health check du backend
   */
  async healthCheck(): Promise<{ status: string }> {
    return apiCall('Health Check', async () => {
      const response = await apiClient.get('/health');
      return response.data;
    });
  },

  /**
   * Récupère la liste des projets
   */
  async getProjects(): Promise<ApiResponse<{ result: Project[] }>> {
    return apiCall('Get Projects', async () => {
      const response = await apiClient.get('/projects');
      return response.data;
    });
  },

  /**
   * Récupère la synthèse multi-projets
   */
  async getMultiProjectSummary(): Promise<ApiResponse<MultiProjectSummaryItem[]>> {
    return apiCall('Get Multi-Project Summary', async () => {
      const response = await apiClient.get('/dashboard/multi');
      return response.data;
    });
  },

  /**
   * Récupère les métriques ISTQB d'un projet
   * Endpoint principal du dashboard
   */
  async getDashboardMetrics(
    projectId: number,
    preprodMilestones: number[] | null = null,
    prodMilestones: number[] | null = null,
    signal: AbortSignal | null = null
  ): Promise<ApiResponse<DashboardMetrics>> {
    try {
      const params: Record<string, string> = {};
      if (preprodMilestones) params.preprodMilestones = preprodMilestones.join(',');
      if (prodMilestones) params.prodMilestones = prodMilestones.join(',');
      const config: { params: Record<string, string>; signal?: AbortSignal } = { params };
      if (signal) config.signal = signal;
      const response = await apiClient.get(`/dashboard/${projectId}`, config);
      return response.data;
    } catch (error) {
      if (
        (error as Error).name === 'AbortError' ||
        (error as Error).name === 'CanceledError'
      ) {
        throw error;
      }
      throw handleError('Get Dashboard Metrics', error as AxiosError | Error);
    }
  },

  /**
   * Récupère les taux qualité d'un projet (escape rate, detection rate...)
   */
  async getQualityRates(
    projectId: number,
    preprodMilestones: number[] | null = null,
    prodMilestones: number[] | null = null,
    signal: AbortSignal | null = null
  ): Promise<ApiResponse<QualityRates>> {
    try {
      const params: Record<string, string> = {};
      if (preprodMilestones) params.preprodMilestones = preprodMilestones.join(',');
      if (prodMilestones) params.prodMilestones = prodMilestones.join(',');
      const config: { params: Record<string, string>; signal?: AbortSignal } = { params };
      if (signal) config.signal = signal;
      const response = await apiClient.get(`/dashboard/${projectId}/quality-rates`, config);
      return response.data;
    } catch (error) {
      if (
        (error as Error).name === 'AbortError' ||
        (error as Error).name === 'CanceledError'
      ) {
        throw error;
      }
      return { success: false } as ApiResponse<QualityRates>;
    }
  },

  /**
   * Récupère les runs d'un projet
   */
  async getProjectRuns(projectId: number, activeOnly = true): Promise<unknown> {
    return apiCall('Get Project Runs', async () => {
      const response = await apiClient.get(`/projects/${projectId}/runs`, {
        params: { active: activeOnly },
      });
      return response.data;
    });
  },

  /**
   * Récupère les milestones d'un projet
   * Le backend renvoie { success: true, data: { result: [...] } }
   */
  async getProjectMilestones(projectId: number): Promise<MilestoneListResponse> {
    return apiCall('Get Project Milestones', async () => {
      const response = await apiClient.get(`/projects/${projectId}/milestones`);
      return response.data.data;
    });
  },

  /**
   * Récupère les détails d'un run
   */
  async getRunDetails(runId: number): Promise<unknown> {
    return apiCall('Get Run Details', async () => {
      const response = await apiClient.get(`/runs/${runId}`);
      return response.data;
    });
  },

  /**
   * Récupère les résultats d'un run
   */
  async getRunResults(runId: number, statusFilter: string | null = null): Promise<unknown> {
    return apiCall('Get Run Results', async () => {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await apiClient.get(`/runs/${runId}/results`, { params });
      return response.data;
    });
  },

  /**
   * Récupère les runs d'automation
   */
  async getAutomationRuns(projectId: number): Promise<unknown> {
    return apiCall('Get Automation Runs', async () => {
      const response = await apiClient.get(`/projects/${projectId}/automation`);
      return response.data;
    });
  },

  /**
   * Récupère les tendances annuelles d'un projet
   */
  async getAnnualTrends(projectId: number): Promise<unknown> {
    return apiCall('Get Annual Trends', async () => {
      const response = await apiClient.get(`/dashboard/${projectId}/annual-trends`);
      return response.data;
    });
  },

  /**
   * Nettoie le cache backend
   */
  async clearCache(): Promise<unknown> {
    return apiCall('Clear Cache', async () => {
      const response = await apiClient.post('/cache/clear');
      return response.data;
    });
  },

  /**
   * Génère un rapport de clôture (HTML / PPTX)
   * ISTQB §5.4.2 Test Closure Report
   */
  async generateReport(params: ReportGenerateParams): Promise<ApiResponse<unknown>> {
    return apiCall('Generate Report', async () => {
      const response = await apiClient.post('/reports/generate', params, { timeout: 120000 });
      return response.data;
    });
  },

  // ---- Dashboard 6: Sync GitLab → Testmo --------------------------------

  /**
   * Récupère la liste des projets sync configurés
   */
  async getSyncProjects(): Promise<SyncProject[]> {
    return apiCall('Get Sync Projects', async () => {
      const response = await apiClient.get('/sync/projects');
      return response.data.data;
    });
  },

  /**
   * Recherche les itérations GitLab disponibles pour un projet
   */
  async getSyncIterations(projectId: string, search = ''): Promise<SyncIteration[]> {
    return apiCall('Get Sync Iterations', async () => {
      const response = await apiClient.get(`/sync/${projectId}/iterations`, {
        params: search ? { search } : {},
      });
      return response.data.data;
    });
  },

  /**
   * Lance un aperçu (dry-run) de synchronisation
   */
  async previewSync(
    projectId: string,
    iterationName: string,
    filters: { labelCustom?: string; status?: string; version?: string; versionDeTest?: string; source?: string } = {}
  ): Promise<SyncPreviewResult> {
    return apiCall('Preview Sync', async () => {
      const response = await apiClient.post(
        '/sync/preview',
        { project_id: projectId, iteration_name: iterationName, ...filters },
        { timeout: 60000 }
      );
      return response.data.data;
    });
  },

  /**
   * Récupère l'historique des synchronisations (50 derniers)
   */
  async getSyncHistory(): Promise<SyncHistoryEntry[]> {
    return apiCall('Get Sync History', async () => {
      const response = await apiClient.get('/sync/history');
      return response.data.data;
    });
  },

  // Note: la synchronisation réelle (execute) utilise EventSource (SSE) côté frontend,
  // pas axios. Voir Dashboard6.jsx → executeSyncSSE().

  // Note: syncStatusToGitLabSSE() utilise aussi fetch+ReadableStream (SSE).
  // Voir l'implémentation dans le composant qui l'appelle.

  // ---- Fin Dashboard 6 ---------------------------------------------------

  // ---- Dashboard 7: CrossTest OK ----------------------------------------

  /**
   * Liste les itérations GitLab du projet 63
   */
  async getCrosstestIterations(search = ''): Promise<SyncIteration[]> {
    return apiCall('Get Crosstest Iterations', async () => {
      const response = await apiClient.get('/crosstest/iterations', {
        params: search ? { search } : {},
      });
      return response.data.data;
    });
  },

  /**
   * Issues avec label CrossTest::OK pour une itération donnée
   */
  async getCrosstestIssues(iterationId: number): Promise<CrosstestIssue[]> {
    return apiCall('Get Crosstest Issues', async () => {
      const response = await apiClient.get(`/crosstest/issues/${iterationId}`);
      return response.data.data;
    });
  },

  /**
   * Récupère tous les commentaires CrossTest (indexés par issue_iid)
   */
  async getCrosstestComments(): Promise<Record<number, CrosstestComment>> {
    return apiCall('Get Crosstest Comments', async () => {
      const response = await apiClient.get('/crosstest/comments');
      return response.data.data;
    });
  },

  /**
   * Crée ou met à jour un commentaire pour une issue
   */
  async saveCrosstestComment(
    iid: number,
    comment: string,
    milestoneContext: string | null = null
  ): Promise<CrosstestComment> {
    return apiCall('Save Crosstest Comment', async () => {
      const response = await apiClient.post('/crosstest/comments', {
        issue_iid: iid,
        comment,
        milestone_context: milestoneContext,
      });
      return response.data.data;
    });
  },

  /**
   * Supprime le commentaire d'une issue
   */
  async deleteCrosstestComment(iid: number): Promise<boolean> {
    return apiCall('Delete Crosstest Comment', async () => {
      const response = await apiClient.delete(`/crosstest/comments/${iid}`);
      return response.data.deleted;
    });
  },

  // ---- Fin Dashboard 7 ---------------------------------------------------

  // ---- Dashboard 8: Auto-Sync Control Panel ------------------------------

  /**
   * Récupère la config courante du cron auto-sync
   */
  async getAutoSyncConfig(): Promise<AutoSyncConfig> {
    return apiCall('Get Auto-Sync Config', async () => {
      const response = await apiClient.get('/sync/auto-config');
      return response.data.data;
    });
  },

  /**
   * Met à jour la config du cron auto-sync à chaud
   */
  async updateAutoSyncConfig(patch: Partial<AutoSyncConfig>): Promise<AutoSyncConfig> {
    return apiCall('Update Auto-Sync Config', async () => {
      const response = await apiClient.put('/sync/auto-config', patch);
      return response.data.data;
    });
  },

  // ---- Notifications -----------------------------------------------------

  async getNotificationSettings(projectId: number | null = null): Promise<ApiResponse<NotificationSettings>> {
    return apiCall('Get Notification Settings', async () => {
      const url = projectId ? `/notifications/settings/${projectId}` : '/notifications/settings';
      const response = await apiClient.get(url);
      return response.data;
    });
  },

  async saveNotificationSettings(settings: NotificationSettings): Promise<ApiResponse<NotificationSettings>> {
    return apiCall('Save Notification Settings', async () => {
      const response = await apiClient.put('/notifications/settings', settings);
      return response.data;
    });
  },

  async testNotificationWebhook(channel: string, url: string): Promise<ApiResponse<unknown>> {
    return apiCall('Test Notification Webhook', async () => {
      const response = await apiClient.post('/notifications/test', { channel, url });
      return response.data;
    });
  },

  // ---- PDF Backend --------------------------------------------------------

  async generateBackendPDF(
    projectId: number,
    milestones: ExportMilestones,
    format = 'A4',
    darkMode = false,
    lang?: string
  ): Promise<Blob> {
    return apiCall('Generate Backend PDF', async () => {
      const response = await apiClient.post(
        '/pdf/generate',
        { projectId, milestones, format, darkMode, lang },
        { responseType: 'blob', timeout: 120000 }
      );
      return response.data;
    });
  },

  // ---- Export CSV / Excel ------------------------------------------------

  async generateCSV(projectId: number, milestones: ExportMilestones, lang?: string): Promise<Blob> {
    return apiCall('Generate CSV', async () => {
      const response = await apiClient.post(
        '/export/csv',
        { projectId, milestones, lang },
        { responseType: 'blob', timeout: 60000 }
      );
      return response.data;
    });
  },

  async generateExcel(projectId: number, milestones: ExportMilestones, lang?: string): Promise<Blob> {
    return apiCall('Generate Excel', async () => {
      const response = await apiClient.post(
        '/export/excel',
        { projectId, milestones, lang },
        { responseType: 'blob', timeout: 60000 }
      );
      return response.data;
    });
  },

  // ---- Anomalies ---------------------------------------------------------

  async getAnomalies(projectId: number): Promise<ApiResponse<AnomalyItem[]>> {
    return apiCall('Get Anomalies', async () => {
      const response = await apiClient.get(`/anomalies/${projectId}`);
      return response.data;
    });
  },

  async getCircuitBreakers(): Promise<ApiResponse<CircuitBreakerState[]>> {
    return apiCall('Get Circuit Breakers', async () => {
      const response = await apiClient.get('/health/circuit-breakers');
      return response.data;
    });
  },

  // ---- Audit Logs --------------------------------------------------------

  async getAuditLogs(filters: Record<string, unknown> = {}): Promise<AuditLogListResponse | ApiErrorResponse> {
    return apiCall('Get Audit Logs', async () => {
      const response = await apiClient.get('/audit', { params: filters });
      return response.data;
    });
  },

  // ---- Feature Flags Admin ------------------------------------------------

  async getFeatureFlagsAdmin(): Promise<ApiResponse<FeatureFlagAdminResponse>> {
    return apiCall('Get Feature Flags Admin', async () => {
      const response = await apiClient.get('/feature-flags/admin');
      return response.data;
    });
  },

  async createFeatureFlag(data: FeatureFlagCreateInput): Promise<ApiResponse<FeatureFlag>> {
    return apiCall('Create Feature Flag', async () => {
      const response = await apiClient.post('/feature-flags/admin', data);
      return response.data;
    });
  },

  async updateFeatureFlag(key: string, data: FeatureFlagUpdateInput): Promise<ApiResponse<FeatureFlag>> {
    return apiCall('Update Feature Flag', async () => {
      const response = await apiClient.put(`/feature-flags/admin/${key}`, data);
      return response.data;
    });
  },

  async deleteFeatureFlag(key: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiCall('Delete Feature Flag', async () => {
      const response = await apiClient.delete(`/feature-flags/admin/${key}`);
      return response.data;
    });
  },

  // ---- Testmo Browser (Manual Runs) -------------------------------------

  async createTestmoManualRun(data: {
    projectId: number;
    name: string;
    milestoneId?: number;
    configId?: number;
    caseIds?: number[];
  }): Promise<ApiResponse<{ runId: number; url: string }>> {
    return apiCall('Create Testmo Manual Run', async () => {
      const response = await apiClient.post('/testmo-browser/runs', data);
      return response.data;
    });
  },

  async addTestmoManualRunResults(
    runId: number,
    data: {
      projectId: number;
      results: Array<{
        caseId?: number;
        testId?: number;
        status: string;
        note?: string;
        elapsed?: number;
      }>;
    }
  ): Promise<ApiResponse<{ updated: number; errors: number }>> {
    return apiCall('Add Testmo Manual Run Results', async () => {
      const response = await apiClient.post(`/testmo-browser/runs/${runId}/results`, data);
      return response.data;
    });
  },

  async checkTestmoBrowserHealth(): Promise<ApiResponse<{ ok: boolean; message: string }>> {
    return apiCall('Check Testmo Browser Health', async () => {
      const response = await apiClient.get('/testmo-browser/health');
      return response.data;
    });
  },

  // ---- Fin Dashboard 8 ---------------------------------------------------

  /**
   * Gestion des erreurs
   * @private
   */
  _handleError(operation: string, error: AxiosError | Error): Error {
    return handleError(operation, error);
  },
};

export default apiService;
