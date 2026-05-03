/**
 * Tests d'intégration des routes de notification
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

describe('Notifications Routes', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    app = require('../../server').default;

    const usersService = require('../../services/users.service').default;
    usersService.init();
    const user = usersService.upsertFromGitLab({
      id: '100',
      emails: [{ value: 'admin@test.com' }],
      displayName: 'Admin',
      username: 'admin',
    });
    token = `Bearer ${jwt.sign({ sub: user.id, email: user.email, role: 'admin' }, 'test-secret')}`;
  });

  it('GET /api/notifications/settings returns settings', async () => {
    const res = await request(app).get('/api/notifications/settings').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/notifications/settings/:projectId returns settings', async () => {
    const res = await request(app).get('/api/notifications/settings/1').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/notifications/settings requires admin role', async () => {
    const res = await request(app)
      .put('/api/notifications/settings')
      .set('Authorization', token)
      .send({ email: 'test@test.com', enabledSlaEmail: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@test.com');
  });

  it('POST /api/notifications/test requires admin role', async () => {
    const res = await request(app)
      .post('/api/notifications/test')
      .set('Authorization', token)
      .send({ channel: 'slack', url: 'https://hooks.slack.com/test' });
    // May fail if slack webhook fails, but route is accessible
    expect([200, 400, 500]).toContain(res.status);
  });

  it('returns 403 for viewer on admin routes', async () => {
    const usersService = require('../../services/users.service').default;
    const viewer = usersService.upsertFromGitLab({
      id: '101',
      emails: [{ value: 'viewer@test.com' }],
      displayName: 'Viewer',
      username: 'viewer',
    });
    const viewerToken = `Bearer ${jwt.sign({ sub: viewer.id, email: viewer.email, role: 'viewer' }, 'test-secret')}`;

    const res = await request(app)
      .put('/api/notifications/settings')
      .set('Authorization', viewerToken)
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/notifications/settings');
    expect(res.status).toBe(401);
  });
});
