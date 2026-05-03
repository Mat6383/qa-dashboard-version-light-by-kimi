/**
 * Tests d'intégration API — Supertest
 * Valide les routes Express avec les routers modulaires
 */

const request = require('supertest');
const app = require('../../server').default;

// Mocker le service Testmo pour éviter les appels réseau
jest.mock('../../services/testmo.service', () => {
  const mockMetrics = {
    completionRate: 90,
    passRate: 95,
    failureRate: 2,
    testEfficiency: 96,
    raw: { total: 100, completed: 90, passed: 95, failed: 2, blocked: 1, skipped: 2 },
    slaStatus: { ok: true, alerts: [] },
    statusDistribution: {
      labels: ['Passed', 'Failed', 'Blocked', 'Skipped'],
      values: [95, 2, 1, 2],
      colors: ['#10B981', '#EF4444', '#F59E0B', '#6B7280'],
    },
    lean: { wipTotal: 5, throughput: 10 },
    itil: { changeSuccessRate: 98, changeFailRate: 2, mttr: 30 },
  };

  return {
    clearCache: jest.fn(() => true),
    getProjects: jest.fn(() => Promise.resolve({ result: [{ id: 1, name: 'Test Project' }] })),
    getProjectMetrics: jest.fn(() => Promise.resolve(mockMetrics)),
    getEscapeAndDetectionRates: jest.fn(() =>
      Promise.resolve({
        escapeRate: 2,
        detectionRate: 98,
        bugsInProd: 1,
        bugsInTest: 49,
        totalBugs: 50,
      })
    ),
    getAnnualQualityTrends: jest.fn(() => Promise.resolve({ years: [], data: [] })),
    getProjectRuns: jest.fn(() => Promise.resolve([])),
    getProjectMilestones: jest.fn(() => Promise.resolve([])),
    getRunDetails: jest.fn(() => Promise.resolve({})),
    getRunResults: jest.fn(() => Promise.resolve([])),
    getAutomationRuns: jest.fn(() => Promise.resolve([])),
    apiGet: jest.fn(() => Promise.resolve({ result: [] })),
    healthCheck: jest.fn(() => Promise.resolve({ ok: true, responseTimeMs: 120 })),
  };
});

jest.mock('../../services/gitlab.service', () => ({
  healthCheck: jest.fn(() => Promise.resolve({ ok: true, responseTimeMs: 80 })),
}));

jest.mock('../../services/apiTimer.service', () => ({
  instrumentAxios: jest.fn(),
  getStats: jest.fn(() => ({
    testmo: { totalCalls: 5, errors: 0, avgResponseTimeMs: 120, p95ResponseTimeMs: 250, lastCallsCount: 5 },
  })),
}));

describe('API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('returns health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/health/detailed', () => {
    it('returns detailed health with all checks OK', async () => {
      const res = await request(app).get('/api/health/detailed');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('syncHistoryDB');
      expect(res.body.checks).toHaveProperty('commentsDB');
      expect(res.body.checks).toHaveProperty('testmoAPI');
      expect(res.body.checks).toHaveProperty('gitlabAPI');
      expect(res.body.checks.testmoAPI.status).toBe('OK');
      expect(res.body.checks.gitlabAPI.status).toBe('OK');
      expect(res.body).toHaveProperty('apiStats');
    });
  });

  describe('GET /api/projects', () => {
    it('returns list of projects', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('result');
      expect(Array.isArray(res.body.data.result)).toBe(true);
    });
  });

  describe('GET /api/dashboard/multi', () => {
    it('returns multi-project summary', async () => {
      const res = await request(app).get('/api/dashboard/multi');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/dashboard/:projectId', () => {
    it('returns metrics for valid project ID', async () => {
      const res = await request(app).get('/api/dashboard/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('completionRate');
      expect(res.body.data).toHaveProperty('passRate');
    });

    it('returns 400 for invalid project ID', async () => {
      const res = await request(app).get('/api/dashboard/abc');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/dashboard/:projectId/quality-rates', () => {
    it('returns quality rates', async () => {
      const res = await request(app).get('/api/dashboard/1/quality-rates');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('escapeRate');
    });
  });

  describe('POST /api/cache/clear', () => {
    it('refuses without admin token', async () => {
      const res = await request(app).post('/api/cache/clear');
      expect(res.status).toBe(501);
    });

    it('clears the cache with admin token', async () => {
      process.env.ADMIN_API_TOKEN = 'test-admin-token';
      const res = await request(app).post('/api/cache/clear').set('X-Admin-Token', 'test-admin-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/cleared/i);
      delete process.env.ADMIN_API_TOKEN;
    });
  });

  describe('GET /api/sync/projects', () => {
    it('returns configured sync projects', async () => {
      const res = await request(app).get('/api/sync/projects');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/crosstest/comments', () => {
    it('returns comments (empty or array)', async () => {
      const res = await request(app).get('/api/crosstest/comments');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/crosstest/comments', () => {
    it('creates a comment', async () => {
      const res = await request(app)
        .post('/api/crosstest/comments')
        .send({ issue_iid: 1, comment: 'Test comment', milestone_context: 'R14' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('issue_iid', 1);
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request(app).post('/api/crosstest/comments').send({ comment: 'Missing iid' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/reports/generate', () => {
    it('requires projectId', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .send({ formats: { html: true } });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('requires at least one format', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .send({ projectId: 1, runIds: [123], formats: {} });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/non trouvée/i);
    });
  });
});
