/**
 * Tests d'intégration des routes d'audit
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

describe('Audit Routes', () => {
  let app;
  let auditService;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    app = require('../../server').default;

    const usersService = require('../../services/users.service').default;
    usersService.init();
    usersService.upsertFromGitLab({
      id: '999',
      emails: [{ value: 'admin@test.com' }],
      displayName: 'Admin',
      username: 'admin',
    });
    usersService.upsertFromGitLab({
      id: '998',
      emails: [{ value: 'viewer@test.com' }],
      displayName: 'Viewer',
      username: 'viewer',
    });
    // Force roles
    usersService.updateRole(1, 'admin');
    usersService.updateRole(2, 'viewer');

    auditService = require('../../services/audit.service').default;
    auditService.init();
  });

  function authHeader(userId = 1, role = 'admin') {
    const email = role === 'admin' ? 'admin@test.com' : 'viewer@test.com';
    const token = jwt.sign({ sub: userId, email, role }, 'test-secret');
    return `Bearer ${token}`;
  }

  it('GET /api/audit returns 403 for viewer', async () => {
    const res = await request(app).get('/api/audit').set('Authorization', authHeader(2, 'viewer'));
    expect(res.status).toBe(403);
  });

  it('GET /api/audit returns 401 without token', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(401);
  });

  it('GET /api/audit returns paginated logs for admin', async () => {
    // Seed some audit data
    auditService.log({ action: 'cache.clear', actorId: 1, actorEmail: 'admin@test.com', statusCode: 200 });
    auditService.log({ action: 'export.csv', actorId: 1, actorEmail: 'admin@test.com', statusCode: 200 });

    const res = await request(app).get('/api/audit').set('Authorization', authHeader(1, 'admin'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.limit).toBe(50);
    expect(res.body.offset).toBe(0);
  });

  it('GET /api/audit filters by action', async () => {
    auditService.log({ action: 'cache.clear' });
    auditService.log({ action: 'export.csv' });

    const res = await request(app).get('/api/audit?action=export.csv').set('Authorization', authHeader(1, 'admin'));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].action).toBe('export.csv');
  });

  it('GET /api/audit supports pagination via limit/offset', async () => {
    for (let i = 0; i < 5; i++) {
      auditService.log({ action: 'test.action' });
    }

    const res = await request(app).get('/api/audit?limit=2&offset=0').set('Authorization', authHeader(1, 'admin'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });
});
