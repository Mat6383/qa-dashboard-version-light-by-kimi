/**
 * Tests d'intégration des routes webhooks
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

describe('Webhooks Routes', () => {
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

  it('GET /api/webhooks retourne la liste', async () => {
    const res = await request(app).get('/api/webhooks').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/webhooks crée une subscription', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'http://hook.example.com', events: ['metric.alert'], secret: 'shh' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBe('http://hook.example.com');
  });

  it('POST /api/webhooks retourne 400 si body invalide', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'not-a-url', events: [] });
    expect(res.status).toBe(400);
  });

  it('PUT /api/webhooks/:id met à jour une subscription', async () => {
    const createRes = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'http://old.example.com', events: ['e1'], secret: 's' });
    const id = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/webhooks/${id}`)
      .set('Authorization', token)
      .send({ url: 'http://new.example.com', enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBe('http://new.example.com');
  });

  it('PUT /api/webhooks/:id retourne 404 si inexistant', async () => {
    const res = await request(app).put('/api/webhooks/99999').set('Authorization', token).send({ enabled: false });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/webhooks/:id supprime une subscription', async () => {
    const createRes = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'http://del.example.com', events: ['e1'], secret: 's' });
    const id = createRes.body.data.id;

    const res = await request(app).delete(`/api/webhooks/${id}`).set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(true);
  });

  it('DELETE /api/webhooks/:id retourne 404 si inexistant', async () => {
    const res = await request(app).delete('/api/webhooks/99999').set('Authorization', token);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/webhooks gère une erreur serveur', async () => {
    const webhooksService = require('../../services/webhooks.service').default;
    jest.spyOn(webhooksService, 'getAll').mockImplementation(() => {
      throw new Error('DB fail');
    });
    const res = await request(app).get('/api/webhooks').set('Authorization', token);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/webhooks retourne 500 si création échoue', async () => {
    const webhooksService = require('../../services/webhooks.service').default;
    jest.spyOn(webhooksService, 'create').mockReturnValue(null);
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'http://fail.example.com', events: ['e1'], secret: 's' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/webhooks retourne 500 si mise à jour échoue', async () => {
    const webhooksService = require('../../services/webhooks.service').default;
    const createRes = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'http://old.example.com', events: ['e1'], secret: 's' });
    const id = createRes.body.data.id;

    jest.spyOn(webhooksService, 'update').mockReturnValue(false);
    const res = await request(app).put(`/api/webhooks/${id}`).set('Authorization', token).send({ enabled: false });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/webhooks retourne 500 si suppression échoue', async () => {
    const webhooksService = require('../../services/webhooks.service').default;
    const createRes = await request(app)
      .post('/api/webhooks')
      .set('Authorization', token)
      .send({ url: 'http://del.example.com', events: ['e1'], secret: 's' });
    const id = createRes.body.data.id;

    jest.spyOn(webhooksService, 'delete').mockReturnValue(false);
    const res = await request(app).delete(`/api/webhooks/${id}`).set('Authorization', token);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('requêtes sans token retournent 401', async () => {
    const res = await request(app).get('/api/webhooks');
    expect(res.status).toBe(401);
  });

  it('requêtes avec rôle non-admin retournent 403', async () => {
    const usersService = require('../../services/users.service').default;
    const user = usersService.upsertFromGitLab({
      id: '101',
      emails: [{ value: 'user@test.com' }],
      displayName: 'User',
      username: 'user',
    });
    const userToken = `Bearer ${jwt.sign({ sub: user.id, email: user.email, role: 'user' }, 'test-secret')}`;

    const res = await request(app).get('/api/webhooks').set('Authorization', userToken);
    expect(res.status).toBe(403);
  });
});
