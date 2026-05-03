/**
 * Tests d'intégration de la route SSE dashboard
 */

const http = require('http');

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/testmo.service', () => ({
  getProjectMetrics: jest.fn(),
  getEscapeAndDetectionRates: jest.fn(),
}));

jest.mock('../../services/notification.service', () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/metricSnapshots.service', () => ({
  init: jest.fn(),
  getTrends: jest.fn().mockReturnValue([]),
}));

jest.mock('../../services/sentry.service', () => ({
  init: jest.fn(),
  getMiddlewares: jest.fn(() => ({
    requestHandler: (req, res, next) => next(),
    errorHandler: (err, req, res, next) => next(err),
  })),
}));

describe('Dashboard SSE Stream', () => {
  let app;
  let server;
  let testmoService;
  let sockets = new Set();

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    app = require('../../server').default;
    testmoService = require('../../services/testmo.service');
    sockets = new Set();
  });

  afterEach((done) => {
    jest.clearAllMocks();
    if (server) {
      sockets.forEach((socket) => socket.destroy());
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close(() => {
        server = null;
        done();
      });
    } else {
      done();
    }
  });

  function startServer() {
    server = app.listen(0);
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    return server;
  }

  it('GET /api/dashboard/:projectId/stream renvoie les headers SSE', (done) => {
    testmoService.getProjectMetrics.mockResolvedValue({ passRate: 95 });
    testmoService.getEscapeAndDetectionRates.mockResolvedValue({ escapeRate: 2 });

    startServer();
    const port = server.address().port;
    const req = http.get(`http://localhost:${port}/api/dashboard/1/stream`, (res) => {
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/event-stream');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['connection']).toBe('keep-alive');
      req.destroy();
      done();
    });
  });

  it('envoie un événement metrics avec les données du projet', (done) => {
    testmoService.getProjectMetrics.mockResolvedValue({
      passRate: 92,
      completionRate: 85,
    });
    testmoService.getEscapeAndDetectionRates.mockResolvedValue({
      escapeRate: 3,
      detectionRate: 97,
    });

    let buffer = '';
    startServer();
    const port = server.address().port;
    const req = http.get(`http://localhost:${port}/api/dashboard/1/stream`, (res) => {
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes('event: metrics')) {
          expect(buffer).toContain('"passRate":92');
          expect(buffer).toContain('"escapeRate":3');
          req.destroy();
          done();
        }
      });
    });
  });

  it('envoie un heartbeat ping toutes les 15s', (done) => {
    testmoService.getProjectMetrics.mockResolvedValue({ passRate: 95 });
    testmoService.getEscapeAndDetectionRates.mockResolvedValue({ escapeRate: 2 });

    let buffer = '';
    startServer();
    const port = server.address().port;
    const req = http.get(`http://localhost:${port}/api/dashboard/1/stream`, (res) => {
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes(': ping')) {
          req.destroy();
          done();
        }
      });
    });
  }, 20000);

  it('renvoie 400 pour un projectId invalide', (done) => {
    startServer();
    const port = server.address().port;
    http.get(`http://localhost:${port}/api/dashboard/abc/stream`, (res) => {
      expect(res.statusCode).toBe(400);
      res.resume();
      res.on('end', () => done());
    });
  });
});
