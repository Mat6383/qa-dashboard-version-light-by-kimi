/**
 * Tests d'intégration de la route circuit-breakers
 */

const request = require('supertest');

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/sentry.service', () => ({
  init: jest.fn(),
  getMiddlewares: jest.fn(() => ({
    requestHandler: (req, res, next) => next(),
    errorHandler: (err, req, res, next) => next(err),
  })),
}));

describe('Circuit Breakers Health', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    app = require('../../server').default;
  });

  it('GET /api/health/circuit-breakers retourne les statuts', async () => {
    const res = await request(app).get('/api/health/circuit-breakers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(3);

    const names = res.body.data.map((b) => b.name);
    expect(names).toContain('testmo');
    expect(names).toContain('gitlab');
    expect(names).toContain('statusSync');

    res.body.data.forEach((b) => {
      expect(b).toHaveProperty('state');
      expect(b).toHaveProperty('failures');
    });
  });
});
