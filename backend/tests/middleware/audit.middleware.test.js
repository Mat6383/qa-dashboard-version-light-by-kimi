/**
 * Tests du middleware d'audit
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');

jest.mock('better-sqlite3', () => {
  const actual = jest.requireActual('better-sqlite3');
  return jest.fn(() => new actual(':memory:'));
});

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Audit Middleware', () => {
  let app;
  let auditService;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';

    const { auditAction } = require('../../middleware/audit.middleware');
    auditService = require('../../services/audit.service').default;
    auditService.init();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      // Simulate auth middleware attaching user
      const token = req.headers.authorization?.slice(7);
      if (token) {
        try {
          const payload = jwt.verify(token, 'test-secret');
          req.user = { id: payload.sub, email: payload.email, role: payload.role };
        } catch {
          // ignore
        }
      }
      next();
    });

    app.post('/api/test-action', auditAction('test.action'), (req, res) => {
      res.json({ success: true });
    });

    app.get('/api/no-audit', (req, res) => {
      res.json({ success: true });
    });
  });

  function authHeader(role = 'admin', userId = 999) {
    const token = jwt.sign({ sub: userId, email: 'tester@test.com', role }, 'test-secret');
    return `Bearer ${token}`;
  }

  it('writes audit row on audited route', async () => {
    await request(app).post('/api/test-action').set('Authorization', authHeader()).send({});

    const result = auditService.query({ action: 'test.action', limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0].status_code).toBe(200);
    expect(result.data[0].success).toBe(true);
    expect(result.data[0].actor_email).toBe('tester@test.com');
  });

  it('does NOT write audit row on non-audited route', async () => {
    await request(app).get('/api/no-audit');

    const result = auditService.query({ limit: 10 });
    expect(result.total).toBe(0);
  });

  it('handles unauthenticated requests gracefully', async () => {
    await request(app).post('/api/test-action').send({});

    const result = auditService.query({ action: 'test.action', limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0].actor_id).toBeNull();
    expect(result.data[0].actor_email).toBeNull();
    expect(result.data[0].status_code).toBe(200);
  });

  it('captures failed responses', async () => {
    const { auditAction } = require('../../middleware/audit.middleware');
    const app2 = express();
    app2.use(express.json());
    app2.use((req, res, next) => {
      req.user = { id: 1, email: 'a@b.com', role: 'admin' };
      next();
    });
    app2.post('/api/fail', auditAction('test.fail'), (req, res) => {
      res.status(500).json({ error: 'oops' });
    });

    await request(app2).post('/api/fail').send({});

    const result = auditService.query({ action: 'test.fail', limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0].status_code).toBe(500);
    expect(result.data[0].success).toBe(false);
  });
});
