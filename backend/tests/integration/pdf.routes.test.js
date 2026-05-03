/**
 * Tests d'intégration des routes PDF
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

jest.mock('../../services/pdf.service', () => ({
  __esModule: true,
  default: {
    generateDashboardPDF: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-1.4 test'), durationMs: 1245 }),
  },
}));

jest.mock('../../services/testmo.service', () => ({
  getProjectMetrics: jest.fn().mockResolvedValue({
    projectName: 'Test Project',
    passRate: 85,
    completionRate: 90,
    escapeRate: 2,
    detectionRate: 95,
    blockedRate: 3,
    totalTests: 100,
    runs: [],
    slaStatus: { ok: true },
  }),
}));

describe('PDF Routes', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    app = require('../../server').default;

    const usersService = require('../../services/users.service').default;
    usersService.init();
    const user = usersService.upsertFromGitLab({
      id: '200',
      emails: [{ value: 'pdf@test.com' }],
      displayName: 'PDF Tester',
      username: 'pdf',
    });
    token = `Bearer ${jwt.sign({ sub: user.id, email: user.email, role: 'admin' }, 'test-secret')}`;
  });

  it('POST /api/pdf/generate returns PDF buffer', async () => {
    const res = await request(app)
      .post('/api/pdf/generate')
      .set('Authorization', token)
      .send({ projectId: 1, format: 'A4' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('POST /api/pdf/generate returns 400 without projectId', async () => {
    const res = await request(app).post('/api/pdf/generate').set('Authorization', token).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/pdf/generate returns 401 without token', async () => {
    const res = await request(app).post('/api/pdf/generate').send({ projectId: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/pdf/generate retourne le header X-PDF-Generation-Time', async () => {
    const res = await request(app)
      .post('/api/pdf/generate')
      .set('Authorization', token)
      .send({ projectId: 1, format: 'A4' });

    expect(res.status).toBe(200);
    expect(res.headers['x-pdf-generation-time']).toBe('1245');
  });
});
