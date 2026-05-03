/**
 * Tests d'intégration des routes Export (CSV / Excel)
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

jest.mock('../../services/testmo.service', () => ({
  getProjectMetrics: jest.fn().mockResolvedValue({
    projectName: 'Test Project',
    passRate: 85,
    completionRate: 90,
    escapeRate: 2,
    detectionRate: 95,
    blockedRate: 3,
    failureRate: 5,
    testEfficiency: 94,
    raw: {
      total: 100,
      passed: 85,
      failed: 5,
      blocked: 3,
      skipped: 2,
      wip: 1,
      untested: 4,
      completed: 95,
      success: 85,
      failure: 5,
    },
    runs: [
      {
        id: 1,
        name: 'Run A',
        total: 50,
        completed: 48,
        passed: 45,
        failed: 3,
        blocked: 0,
        wip: 0,
        untested: 2,
        completionRate: 96,
        passRate: 94,
        isExploratory: false,
        isClosed: false,
        created_at: '2026-04-20T10:00:00Z',
      },
    ],
    slaStatus: { ok: true, alerts: [] },
    itil: { mttr: 12, leadTime: 48, changeFailRate: 5, mttrTarget: 72, leadTimeTarget: 120, changeFailRateTarget: 20 },
    lean: { wipTotal: 1, activeRuns: 2, closedRuns: 5 },
    istqb: {
      avgPassRate: 85,
      passRateTarget: 80,
      milestonesCompleted: 3,
      milestonesTotal: 5,
      blockRate: 3,
      blockRateTarget: 5,
    },
  }),
  getProjects: jest.fn().mockResolvedValue([{ id: 1, name: 'Test Project' }]),
}));

describe('Export Routes', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    app = require('../../server').default;

    const usersService = require('../../services/users.service').default;
    usersService.init();
    const user = usersService.upsertFromGitLab({
      id: '300',
      emails: [{ value: 'export@test.com' }],
      displayName: 'Export Tester',
      username: 'export',
    });
    token = `Bearer ${jwt.sign({ sub: user.id, email: user.email, role: 'admin' }, 'test-secret')}`;
  });

  it('POST /api/export/csv returns CSV buffer', async () => {
    const res = await request(app).post('/api/export/csv').set('Authorization', token).send({ projectId: 1 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.csv');
    expect(res.text).toContain('Projet');
    expect(res.text).toContain('Test Project');
    expect(res.text).toContain('Run A');
  });

  it('POST /api/export/excel returns XLSX buffer', async () => {
    const res = await request(app).post('/api/export/excel').set('Authorization', token).send({ projectId: 1 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });

  it('POST /api/export/csv returns 400 without projectId', async () => {
    const res = await request(app).post('/api/export/csv').set('Authorization', token).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/export/excel returns 400 without projectId', async () => {
    const res = await request(app).post('/api/export/excel').set('Authorization', token).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/export/csv returns 401 without token', async () => {
    const res = await request(app).post('/api/export/csv').send({ projectId: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/export/excel returns 401 without token', async () => {
    const res = await request(app).post('/api/export/excel').send({ projectId: 1 });
    expect(res.status).toBe(401);
  });
});
