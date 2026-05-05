import { describe, it, expect, vi, beforeEach } from 'vitest';

const axiosMockState = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  requestHandlers: [],
  responseHandlers: [],
}));

vi.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      get: (...args) => axiosMockState.mockGet(...args),
      post: (...args) => axiosMockState.mockPost(...args),
      put: (...args) => axiosMockState.mockPut(...args),
      delete: (...args) => axiosMockState.mockDelete(...args),
      interceptors: {
        request: {
          use: (fulfilled, rejected) => axiosMockState.requestHandlers.push({ fulfilled, rejected }),
        },
        response: {
          use: (fulfilled, rejected) => axiosMockState.responseHandlers.push({ fulfilled, rejected }),
        },
      },
    }),
  },
}));

// Import du service APRÈS le mock
const { default: apiService, apiClient } = await import('./api.service');

describe('api.service', () => {
  beforeEach(() => {
    axiosMockState.mockGet.mockReset();
    axiosMockState.mockPost.mockReset();
    axiosMockState.mockPut.mockReset();
    axiosMockState.mockDelete.mockReset();
    localStorage.clear();
  });

  it('healthCheck appelle GET /health', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { status: 'ok' } });
    const result = await apiService.healthCheck();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/health');
    expect(result).toEqual({ status: 'ok' });
  });

  it('getProjects appelle GET /projects', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: [] } });
    await apiService.getProjects();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/projects');
  });

  it('getMultiProjectSummary appelle GET /dashboard/multi', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: [{ id: 1 }] });
    const result = await apiService.getMultiProjectSummary();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/dashboard/multi');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('getDashboardMetrics sérialise les milestones en join(', ')', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    await apiService.getDashboardMetrics(1, [10, 20], [30, 40]);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/dashboard/1', {
      params: { preprodMilestones: '10,20', prodMilestones: '30,40' },
    });
  });

  it('getDashboardMetrics passe le signal AbortController', async () => {
    const controller = new AbortController();
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    await apiService.getDashboardMetrics(1, null, null, controller.signal);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/dashboard/1', {
      params: {},
      signal: controller.signal,
    });
  });

  it('getDashboardMetrics relance AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    axiosMockState.mockGet.mockRejectedValue(abortError);
    await expect(apiService.getDashboardMetrics(1)).rejects.toThrow('Aborted');
  });

  it('getQualityRates retourne { success: false } en cas d erreur (pas de throw)', async () => {
    axiosMockState.mockGet.mockRejectedValue(new Error('Network Error'));
    const result = await apiService.getQualityRates(1);
    expect(result).toEqual({ success: false });
  });

  it('getQualityRates relance AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    axiosMockState.mockGet.mockRejectedValue(abortError);
    await expect(apiService.getQualityRates(1)).rejects.toThrow('Aborted');
  });

  it('getProjectRuns passe active=true par défaut', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: [] });
    await apiService.getProjectRuns(1);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/projects/1/runs', { params: { active: true } });
  });

  it('getProjectMilestones unwrap double .data.data', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: { result: ['M1', 'M2'] } } });
    const result = await apiService.getProjectMilestones(1);
    expect(result).toEqual({ result: ['M1', 'M2'] });
  });

  it('getRunDetails appelle GET /runs/:id', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { id: 5 } });
    const result = await apiService.getRunDetails(5);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/runs/5');
    expect(result).toEqual({ id: 5 });
  });

  it('getRunResults passe le statusFilter', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: [] });
    await apiService.getRunResults(1, '3,5');
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/runs/1/results', { params: { status: '3,5' } });
  });

  it('getAutomationRuns appelle GET /projects/:id/automation', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: [{ name: 'Auto1' }] });
    const result = await apiService.getAutomationRuns(3);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/projects/3/automation');
    expect(result).toEqual([{ name: 'Auto1' }]);
  });

  it('getAnnualTrends appelle GET /dashboard/:id/annual-trends', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { trends: [] } });
    const result = await apiService.getAnnualTrends(7);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/dashboard/7/annual-trends');
    expect(result).toEqual({ trends: [] });
  });

  it('clearCache appelle POST /cache/clear', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { cleared: true } });
    const result = await apiService.clearCache();
    expect(axiosMockState.mockPost).toHaveBeenCalledWith('/cache/clear');
    expect(result).toEqual({ cleared: true });
  });

  it('generateReport utilise un timeout de 120s', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { success: true } });
    await apiService.generateReport({ projectId: 1 });
    expect(axiosMockState.mockPost).toHaveBeenCalledWith('/reports/generate', { projectId: 1 }, { timeout: 120000 });
  });

  it('getSyncIterations passe search param', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: [{ id: 'i1' }] } });
    const result = await apiService.getSyncIterations('proj', 'sprint');
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/sync/proj/iterations', { params: { search: 'sprint' } });
    expect(result).toEqual([{ id: 'i1' }]);
  });

  it('getSyncIterations omet search si vide', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: [] } });
    await apiService.getSyncIterations('proj', '');
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/sync/proj/iterations', { params: {} });
  });

  it('previewSync utilise un timeout de 60s', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { data: {} } });
    await apiService.previewSync('neo-pilot', 'R10');
    expect(axiosMockState.mockPost).toHaveBeenCalledWith(
      '/sync/preview',
      { projectId: 'neo-pilot', iterationName: 'R10' },
      { timeout: 60000 }
    );
  });

  it('getSyncHistory unwrap .data.data', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: [{ id: 1 }] } });
    const result = await apiService.getSyncHistory();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/sync/history');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('getCrosstestIterations passe search param', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: [{ id: 'c1' }] } });
    const result = await apiService.getCrosstestIterations('search-term');
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/crosstest/iterations', { params: { search: 'search-term' } });
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('getCrosstestIssues appelle GET /crosstest/issues/:id', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: [{ iid: 1 }] } });
    const result = await apiService.getCrosstestIssues(42);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/crosstest/issues/42');
    expect(result).toEqual([{ iid: 1 }]);
  });

  it('getCrosstestComments unwrap .data.data', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: { 1: { comment: 'ok' } } } });
    const result = await apiService.getCrosstestComments();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/crosstest/comments');
    expect(result).toEqual({ 1: { comment: 'ok' } });
  });

  it('saveCrosstestComment POST avec milestone_context null', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { data: { id: 1 } } });
    const result = await apiService.saveCrosstestComment(5, 'hello');
    expect(axiosMockState.mockPost).toHaveBeenCalledWith('/crosstest/comments', {
      issue_iid: 5,
      comment: 'hello',
      milestone_context: null,
    });
    expect(result).toEqual({ id: 1 });
  });

  it('saveCrosstestComment POST avec milestone_context', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { data: { id: 2 } } });
    const result = await apiService.saveCrosstestComment(5, 'hello', 'M1');
    expect(axiosMockState.mockPost).toHaveBeenCalledWith('/crosstest/comments', {
      issue_iid: 5,
      comment: 'hello',
      milestone_context: 'M1',
    });
    expect(result).toEqual({ id: 2 });
  });

  it('deleteCrosstestComment retourne response.data.deleted', async () => {
    axiosMockState.mockDelete.mockResolvedValue({ data: { deleted: true } });
    const result = await apiService.deleteCrosstestComment(42);
    expect(axiosMockState.mockDelete).toHaveBeenCalledWith('/crosstest/comments/42');
    expect(result).toBe(true);
  });

  it('getAutoSyncConfig unwrap .data.data', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { data: { enabled: true } } });
    const result = await apiService.getAutoSyncConfig();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/sync/auto-config');
    expect(result).toEqual({ enabled: true });
  });

  it('updateAutoSyncConfig PUT et unwrap .data.data', async () => {
    axiosMockState.mockPut.mockResolvedValue({ data: { data: { enabled: false } } });
    const result = await apiService.updateAutoSyncConfig({ enabled: false });
    expect(axiosMockState.mockPut).toHaveBeenCalledWith('/sync/auto-config', { enabled: false });
    expect(result).toEqual({ enabled: false });
  });

  it('getNotificationSettings sans projectId', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    const result = await apiService.getNotificationSettings();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/notifications/settings');
    expect(result).toEqual({ success: true });
  });

  it('getNotificationSettings avec projectId', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    const result = await apiService.getNotificationSettings(7);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/notifications/settings/7');
    expect(result).toEqual({ success: true });
  });

  it('saveNotificationSettings PUT', async () => {
    axiosMockState.mockPut.mockResolvedValue({ data: { success: true } });
    const result = await apiService.saveNotificationSettings({ email: 'a@b.com' });
    expect(axiosMockState.mockPut).toHaveBeenCalledWith('/notifications/settings', { email: 'a@b.com' });
    expect(result).toEqual({ success: true });
  });

  it('testNotificationWebhook POST', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { success: true } });
    const result = await apiService.testNotificationWebhook('slack', 'https://hooks.slack.com');
    expect(axiosMockState.mockPost).toHaveBeenCalledWith('/notifications/test', {
      channel: 'slack',
      url: 'https://hooks.slack.com',
    });
    expect(result).toEqual({ success: true });
  });

  it('generateBackendPDF POST avec blob et timeout 120s', async () => {
    const blob = new Blob(['pdf']);
    axiosMockState.mockPost.mockResolvedValue({ data: blob });
    const result = await apiService.generateBackendPDF(1, { preprod: [10], prod: [20] }, 'A4', true, 'fr');
    expect(axiosMockState.mockPost).toHaveBeenCalledWith(
      '/pdf/generate',
      { projectId: 1, milestones: { preprod: [10], prod: [20] }, format: 'A4', darkMode: true, lang: 'fr' },
      { responseType: 'blob', timeout: 120000 }
    );
    expect(result).toBe(blob);
  });

  it('generateCSV POST avec blob', async () => {
    const blob = new Blob(['csv']);
    axiosMockState.mockPost.mockResolvedValue({ data: blob });
    const result = await apiService.generateCSV(1, { preprod: [10], prod: [20] }, 'en');
    expect(axiosMockState.mockPost).toHaveBeenCalledWith(
      '/export/csv',
      { projectId: 1, milestones: { preprod: [10], prod: [20] }, lang: 'en' },
      { responseType: 'blob', timeout: 60000 }
    );
    expect(result).toBe(blob);
  });

  it('generateExcel POST avec blob', async () => {
    const blob = new Blob(['xlsx']);
    axiosMockState.mockPost.mockResolvedValue({ data: blob });
    const result = await apiService.generateExcel(2, { preprod: [], prod: [] });
    expect(axiosMockState.mockPost).toHaveBeenCalledWith(
      '/export/excel',
      { projectId: 2, milestones: { preprod: [], prod: [] } },
      { responseType: 'blob', timeout: 60000 }
    );
    expect(result).toBe(blob);
  });

  it('getAnomalies appelle GET /anomalies/:id', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    const result = await apiService.getAnomalies(3);
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/anomalies/3');
    expect(result).toEqual({ success: true });
  });

  it('getCircuitBreakers appelle GET /health/circuit-breakers', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    const result = await apiService.getCircuitBreakers();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/health/circuit-breakers');
    expect(result).toEqual({ success: true });
  });

  it('getAuditLogs passe les filtres en params', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { logs: [] } });
    const result = await apiService.getAuditLogs({ projectId: 1, level: 'warn' });
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/audit', { params: { projectId: 1, level: 'warn' } });
    expect(result).toEqual({ logs: [] });
  });

  it('getFeatureFlagsAdmin appelle GET /feature-flags/admin', async () => {
    axiosMockState.mockGet.mockResolvedValue({ data: { success: true } });
    const result = await apiService.getFeatureFlagsAdmin();
    expect(axiosMockState.mockGet).toHaveBeenCalledWith('/feature-flags/admin');
    expect(result).toEqual({ success: true });
  });

  it('createFeatureFlag POST', async () => {
    axiosMockState.mockPost.mockResolvedValue({ data: { success: true } });
    const result = await apiService.createFeatureFlag({ key: 'flag1', enabled: true });
    expect(axiosMockState.mockPost).toHaveBeenCalledWith('/feature-flags/admin', { key: 'flag1', enabled: true });
    expect(result).toEqual({ success: true });
  });

  it('updateFeatureFlag PUT', async () => {
    axiosMockState.mockPut.mockResolvedValue({ data: { success: true } });
    const result = await apiService.updateFeatureFlag('flag1', { enabled: false });
    expect(axiosMockState.mockPut).toHaveBeenCalledWith('/feature-flags/admin/flag1', { enabled: false });
    expect(result).toEqual({ success: true });
  });

  it('deleteFeatureFlag DELETE', async () => {
    axiosMockState.mockDelete.mockResolvedValue({ data: { deleted: true } });
    const result = await apiService.deleteFeatureFlag('flag1');
    expect(axiosMockState.mockDelete).toHaveBeenCalledWith('/feature-flags/admin/flag1');
    expect(result).toEqual({ deleted: true });
  });

  it('_handleError formate le message', async () => {
    axiosMockState.mockGet.mockRejectedValue({ response: { data: { error: 'Not found' } }, message: 'Network error' });
    await expect(apiService.getProjects()).rejects.toThrow('Get Projects: Not found');
  });
});

describe('api.service interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('intercepteur request ajoute x-request-id et le token JWT', () => {
    // Réimporter pour re-créer le client et enregistrer les handlers
    // mais les handlers sont déjà enregistrés lors de l'import statique.
    // Nous utilisons les handlers stockés dans axiosMockState.
    expect(axiosMockState.requestHandlers.length).toBeGreaterThan(0);
    const handler = axiosMockState.requestHandlers[0].fulfilled;

    localStorage.setItem('qa_dashboard_token', 'my-jwt-token');
    const config = { headers: {}, method: 'get', url: '/test' };
    const result = handler(config);

    expect(result.headers['x-request-id']).toBeDefined();
    expect(result.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('intercepteur request ne crash pas sans token', () => {
    const handler = axiosMockState.requestHandlers[0].fulfilled;
    const config = { headers: {}, method: 'post', url: '/login' };
    const result = handler(config);

    expect(result.headers['Authorization']).toBeUndefined();
    expect(result.headers['x-request-id']).toBeDefined();
  });

  it('intercepteur request conserve x-request-id existant', () => {
    const handler = axiosMockState.requestHandlers[0].fulfilled;
    const config = { headers: { 'x-request-id': 'existing-id' }, method: 'get', url: '/test' };
    const result = handler(config);

    expect(result.headers['x-request-id']).toBe('existing-id');
  });

  it('intercepteur request error loggue et reject', async () => {
    const handler = axiosMockState.requestHandlers[0].rejected;
    const error = new Error('Request failed');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handler(error)).rejects.toThrow('Request failed');
    expect(consoleSpy).toHaveBeenCalledWith('[API] Request error:', error);
    consoleSpy.mockRestore();
  });

  it('intercepteur response loggue status et data', () => {
    const handler = axiosMockState.responseHandlers[0].fulfilled;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = { status: 200, data: { ok: true } };
    const result = handler(response);

    expect(result).toBe(response);
    expect(consoleSpy).toHaveBeenCalledWith('[API] Response:', 200, { ok: true });
    consoleSpy.mockRestore();
  });

  it('intercepteur response ignore CanceledError', async () => {
    const handler = axiosMockState.responseHandlers[0].rejected;
    const error = new Error('Canceled');
    error.name = 'CanceledError';

    await expect(handler(error)).rejects.toThrow('Canceled');
  });

  it('intercepteur response ignore AbortError', async () => {
    const handler = axiosMockState.responseHandlers[0].rejected;
    const error = new Error('Aborted');
    error.name = 'AbortError';

    await expect(handler(error)).rejects.toThrow('Aborted');
  });

  it('intercepteur response ignore ERR_CANCELED', async () => {
    const handler = axiosMockState.responseHandlers[0].rejected;
    const error = new Error('Canceled');
    error.code = 'ERR_CANCELED';

    await expect(handler(error)).rejects.toThrow('Canceled');
  });

  it('intercepteur response loggue les erreurs autres', async () => {
    const handler = axiosMockState.responseHandlers[0].rejected;
    const error = { response: { data: { error: 'Server down' } }, message: 'Network Error' };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handler(error)).rejects.toEqual(error);
    expect(consoleSpy).toHaveBeenCalledWith('[API] Response error:', { error: 'Server down' });
    consoleSpy.mockRestore();
  });
});
