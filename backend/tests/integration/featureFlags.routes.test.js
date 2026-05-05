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

describe('Feature Flags Routes', () => {
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

  describe('GET /api/feature-flags', () => {
    it('returns all feature flags (public)', async () => {
      const res = await request(app).get('/api/feature-flags');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('darkMode');
    });
  });

  describe('GET /api/feature-flags/:key', () => {
    it('returns a specific flag state (public)', async () => {
      const res = await request(app).get('/api/feature-flags/darkMode');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ key: 'darkMode', enabled: true, rolloutPercentage: 100 });
    });
  });

  describe('GET /api/feature-flags/admin', () => {
    it('returns detailed flags for admin', async () => {
      const res = await request(app).get('/api/feature-flags/admin').set('Authorization', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/feature-flags/admin');
      expect(res.status).toBe(401);
    });

    it('returns 403 for viewer', async () => {
      const res = await request(app).get('/api/feature-flags/admin').set('Authorization', viewerToken);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/feature-flags/admin', () => {
    it('creates a flag for admin', async () => {
      const featureFlagsService = require('../../services/featureFlags.service').default;
      featureFlagsService.getByKey.mockReturnValueOnce(null);
      const res = await request(app)
        .post('/api/feature-flags/admin')
        .set('Authorization', adminToken)
        .send({ key: 'newFlag', enabled: true, description: 'Test', rolloutPercentage: 50 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 409 for duplicate key', async () => {
      const featureFlagsService = require('../../services/featureFlags.service').default;
      featureFlagsService.getByKey.mockReturnValueOnce({ key: 'existing' });
      const res = await request(app)
        .post('/api/feature-flags/admin')
        .set('Authorization', adminToken)
        .send({ key: 'existing' });
      expect(res.status).toBe(409);
    });

    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .post('/api/feature-flags/admin')
        .set('Authorization', adminToken)
        .send({ key: '' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/feature-flags/admin')
        .set('Authorization', viewerToken)
        .send({ key: 'x' });
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/feature-flags/admin/:key', () => {
    it('updates a flag for admin', async () => {
      const res = await request(app)
        .put('/api/feature-flags/admin/darkMode')
        .set('Authorization', adminToken)
        .send({ enabled: false, description: 'Updated', rolloutPercentage: 75 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for unknown flag', async () => {
      const featureFlagsService = require('../../services/featureFlags.service').default;
      featureFlagsService.getByKey.mockReturnValueOnce(null);
      const res = await request(app)
        .put('/api/feature-flags/admin/ghost')
        .set('Authorization', adminToken)
        .send({ enabled: false });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid rollout', async () => {
      const res = await request(app)
        .put('/api/feature-flags/admin/darkMode')
        .set('Authorization', adminToken)
        .send({ rolloutPercentage: 150 });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/feature-flags/admin/:key', () => {
    it('deletes a flag for admin', async () => {
      const res = await request(app).delete('/api/feature-flags/admin/darkMode').set('Authorization', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });

    it('returns 404 for unknown flag', async () => {
      const featureFlagsService = require('../../services/featureFlags.service').default;
      featureFlagsService.getByKey.mockReturnValueOnce(null);
      const res = await request(app).delete('/api/feature-flags/admin/ghost').set('Authorization', adminToken);
      expect(res.status).toBe(404);
    });
  });
});
