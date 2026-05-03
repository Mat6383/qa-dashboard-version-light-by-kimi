/**
 * Tests d'intégration des routes d'authentification
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

describe('Auth Routes', () => {
  let app;
  let user;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    app = require('../../server').default;

    const usersService = require('../../services/users.service').default;
    usersService.init();
    user = usersService.upsertFromGitLab({
      id: '999',
      emails: [{ value: 'tester@test.com' }],
      displayName: 'Tester',
      username: 'tester',
    });
  });

  function authHeader(userId = 999) {
    const token = jwt.sign({ sub: userId, email: 'tester@test.com', role: 'admin' }, 'test-secret');
    return `Bearer ${token}`;
  }

  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/auth/me returns user data with valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('tester@test.com');
  });

  it('POST /api/auth/logout clears cookies', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/refresh returns 401 without refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/gitlab returns 501 when OAuth not configured', async () => {
    delete process.env.GITLAB_CLIENT_ID;
    delete process.env.GITLAB_CLIENT_SECRET;
    jest.resetModules();
    const freshApp = require('../../server').default;
    const res = await request(freshApp).get('/api/auth/gitlab');
    expect(res.status).toBe(501);
  });
});
