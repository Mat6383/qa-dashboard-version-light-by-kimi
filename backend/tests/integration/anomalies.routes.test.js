/**
 * Tests d'intégration de la route anomalies
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

jest.mock('../../services/anomaly.service', () => ({
  detectAnomalies: jest.fn(),
}));

describe('Anomalies Routes', () => {
  let app;
  let detectAnomalies;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    app = require('../../server').default;
    const anomalyService = require('../../services/anomaly.service');
    detectAnomalies = anomalyService.detectAnomalies;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/anomalies/:projectId retourne les anomalies', async () => {
    detectAnomalies.mockReturnValue([
      {
        metric: 'pass_rate',
        label: 'Pass Rate',
        currentValue: 90,
        mean: 88,
        stdDev: 2,
        zScore: 1,
        severity: 'normal',
        direction: 'up',
      },
      {
        metric: 'completion_rate',
        label: 'Completion Rate',
        currentValue: 85,
        mean: 84,
        stdDev: 1.5,
        zScore: 0.67,
        severity: 'normal',
        direction: 'up',
      },
      {
        metric: 'escape_rate',
        label: 'Escape Rate',
        currentValue: 2,
        mean: 3,
        stdDev: 1,
        zScore: -1,
        severity: 'normal',
        direction: 'up',
      },
      {
        metric: 'detection_rate',
        label: 'Detection Rate',
        currentValue: 95,
        mean: 94,
        stdDev: 1,
        zScore: 1,
        severity: 'normal',
        direction: 'up',
      },
      {
        metric: 'blocked_rate',
        label: 'Blocked Rate',
        currentValue: 1,
        mean: 2,
        stdDev: 1,
        zScore: -1,
        severity: 'normal',
        direction: 'up',
      },
    ]);

    const res = await request(app).get('/api/anomalies/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(res.body.hasAnomaly).toBe(false);
    expect(detectAnomalies).toHaveBeenCalledWith(1);
  });

  it('détecte une anomalie quand les métriques changent brusquement', async () => {
    detectAnomalies.mockReturnValue([
      {
        metric: 'pass_rate',
        label: 'Pass Rate',
        currentValue: 50,
        mean: 90,
        stdDev: 5,
        zScore: -8,
        severity: 'critical',
        direction: 'down',
      },
    ]);

    const res = await request(app).get('/api/anomalies/1');

    expect(res.status).toBe(200);
    expect(res.body.hasAnomaly).toBe(true);
    const passRateAnomaly = res.body.data.find((a) => a.metric === 'pass_rate');
    expect(passRateAnomaly.severity).toBe('critical');
  });

  it('renvoie 400 pour un projectId invalide', async () => {
    const res = await request(app).get('/api/anomalies/abc');
    expect(res.status).toBe(400);
  });

  it('retourne un tableau vide si pas assez d historique', async () => {
    detectAnomalies.mockReturnValue([]);

    const res = await request(app).get('/api/anomalies/1');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.hasAnomaly).toBe(false);
  });
});
