/**
 * Tests d'intégration — Routes sous-couvertes
 * Couvre featureFlags, runs, projects/*, crosstest/*, sync/*, reports/generate succès
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('better-sqlite3', () => {
  const actual = jest.requireActual('better-sqlite3');
  return jest.fn(() => new actual(':memory:'));
});

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';
const app = require('../../server').default;

jest.mock('../../services/testmo.service', () => ({
  getRunDetails: jest.fn(() => Promise.resolve({ id: 1, name: 'R01' })),
  getRunResults: jest.fn(() => Promise.resolve([{ id: 101, status_id: 3, title: 'Test case 1' }])),
  getProjectRuns: jest.fn(() => Promise.resolve([{ id: 1, name: 'R01', is_completed: false }])),
  getProjectMilestones: jest.fn(() => Promise.resolve([{ id: 1, name: 'M1' }])),
  getAutomationRuns: jest.fn(() => Promise.resolve([{ id: 1, name: 'Auto-1' }])),
  getProjects: jest.fn(() => Promise.resolve({ result: [{ id: 1, name: 'Alpha' }] })),
  getProjectMetrics: jest.fn(() => Promise.resolve({})),
  apiGet: jest.fn((url) => {
    if (url && url.includes('/runs?limit=50')) {
      return Promise.resolve({ result: [{ id: 10, name: 'R01-run', milestone_id: 5 }] });
    }
    return Promise.resolve({ result: [] });
  }),
  healthCheck: jest.fn(() => Promise.resolve({ ok: true })),
  clearCache: jest.fn(() => true),
}));

jest.mock('../../services/gitlab.service', () => ({
  __esModule: true,
  default: {
    healthCheck: jest.fn(() => Promise.resolve({ ok: true })),
    searchIterations: jest.fn(() =>
      Promise.resolve([{ id: 1, title: 'R01', state: 'active', web_url: 'http://gl/1' }])
    ),
    getIssuesByLabelAndIterationForProject: jest.fn(() =>
      Promise.resolve([
        {
          iid: 1,
          title: 'Issue 1',
          web_url: 'http://gl/1',
          state: 'opened',
          assignees: [{ name: 'Alice' }],
          labels: ['CrossTest::OK', 'bug'],
          created_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
      ])
    ),
  },
}));

jest.mock('../../services/featureFlags.service', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(() => ({ darkMode: true, betaFeature: false })),
    getAllDetails: jest.fn(() => [
      {
        key: 'darkMode',
        enabled: true,
        description: 'Dark theme',
        rolloutPercentage: 100,
        updatedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        key: 'betaFeature',
        enabled: false,
        description: 'Beta',
        rolloutPercentage: 0,
        updatedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]),
    getByKey: jest.fn((key) => ({
      key,
      enabled: key === 'darkMode',
      description: 'Test',
      rolloutPercentage: 100,
      updatedAt: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    })),
    isEnabled: jest.fn((key) => key === 'darkMode'),
    set: jest.fn(() => true),
    create: jest.fn(() => true),
    update: jest.fn(() => true),
    delete: jest.fn(() => true),
  },
}));

jest.mock('../../services/comments.service', () => ({
  getAll: jest.fn(() => ({
    1: { id: 1, issue_iid: 1, comment: 'Test comment', milestone_context: 'R01' },
  })),
  upsert: jest.fn((iid, comment, milestoneContext) => ({
    id: iid,
    issue_iid: iid,
    comment,
    milestone_context: milestoneContext,
  })),
  delete: jest.fn(() => true),
  init: jest.fn(),
}));

jest.mock('../../services/syncHistory.service', () => ({
  __esModule: true,
  default: {
    getHistory: jest.fn(() => [{ id: 1, project_name: 'Alpha', iteration_name: 'R01', mode: 'preview' }]),
    addRun: jest.fn(),
    initDb: jest.fn(),
    _initialized: true,
    db: null,
  },
}));

jest.mock('../../services/report.service', () => {
  return jest.fn().mockImplementation(() => ({
    collectReportData: jest.fn(() =>
      Promise.resolve({
        milestoneName: 'R01',
        verdict: 'GO',
        stats: { totalTests: 100, passRate: 95 },
        failedTests: [],
      })
    ),
    generateHTML: jest.fn(() => '<html>report</html>'),
    generatePPTX: jest.fn(() =>
      Promise.resolve({
        write: jest.fn(() => Promise.resolve(Buffer.from('pptx'))),
      })
    ),
  }));
});

jest.mock('../../services/apiTimer.service', () => ({
  instrumentAxios: jest.fn(),
  getStats: jest.fn(() => ({
    testmo: { totalCalls: 0, errors: 0, avgResponseTimeMs: 0, p95ResponseTimeMs: 0, lastCallsCount: 0 },
  })),
}));

describe('Routes Coverage Integration Tests', () => {
  let adminToken;
  let viewerToken;

  beforeAll(() => {
    process.env.ADMIN_API_TOKEN = 'test-admin-token';
    process.env.JWT_SECRET = 'test-secret';

    const usersService = require('../../services/users.service').default;
    usersService.init();
    const admin = usersService.upsertFromGitLab({
      id: '100',
      emails: [{ value: 'admin@test.com' }],
      displayName: 'Admin',
      username: 'admin',
    });
    const viewer = usersService.upsertFromGitLab({
      id: '101',
      emails: [{ value: 'viewer@test.com' }],
      displayName: 'Viewer',
      username: 'viewer',
    });
    adminToken = `Bearer ${jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' }, 'test-secret')}`;
    viewerToken = `Bearer ${jwt.sign({ sub: viewer.id, email: viewer.email, role: 'viewer' }, 'test-secret')}`;
  });

  afterAll(() => {
    delete process.env.ADMIN_API_TOKEN;
    delete process.env.JWT_SECRET;
  });

  // ─── Runs ──────────────────────────────────────────────────────────────────
  describe('GET /api/runs/:runId', () => {
    it('returns run details', async () => {
      const res = await request(app).get('/api/runs/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', 1);
    });

    it('returns 400 for invalid runId', async () => {
      const res = await request(app).get('/api/runs/abc');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/runs/:runId/results', () => {
    it('returns run results', async () => {
      const res = await request(app).get('/api/runs/1/results');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts status filter query', async () => {
      const res = await request(app).get('/api/runs/1/results?status=3,5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Projects ──────────────────────────────────────────────────────────────
  describe('GET /api/projects/:projectId/runs', () => {
    it('returns project runs', async () => {
      const res = await request(app).get('/api/projects/1/runs');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/projects/:projectId/milestones', () => {
    it('returns project milestones', async () => {
      const res = await request(app).get('/api/projects/1/milestones');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/projects/:projectId/automation', () => {
    it('returns automation runs', async () => {
      const res = await request(app).get('/api/projects/1/automation');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── Reports ───────────────────────────────────────────────────────────────
  describe('POST /api/reports/generate', () => {
    it('generates report successfully', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .send({
          projectId: 1,
          runIds: [101],
          formats: { html: true, pptx: true },
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.files).toHaveProperty('html');
      expect(res.body.files).toHaveProperty('pptx');
      expect(res.body.summary).toHaveProperty('verdict', 'GO');
    });

    it('falls back to milestoneId when runIds empty', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .send({
          projectId: 1,
          milestoneId: 5,
          formats: { html: true },
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Docs ────────────────────────────────────────────────────────────────────
  describe('GET /api/docs', () => {
    it('serves Swagger UI HTML', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });
  });

  // ─── Metrics ─────────────────────────────────────────────────────────────────
  describe('GET /metrics', () => {
    it('returns Prometheus metrics', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('qa_dashboard_');
    });
  });
});
