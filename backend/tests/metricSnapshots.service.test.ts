import service from '../services/metricSnapshots.service';
/**
 * Tests du service MetricSnapshots
 */

jest.mock('better-sqlite3', () => {
  const actual = jest.requireActual('better-sqlite3');
  return jest.fn(() => new actual(':memory:'));
});

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('MetricSnapshotsService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('saves and retrieves snapshots', () => {
    service.init();

    service.saveSnapshot(1, {
      passRate: 85.5,
      completionRate: 90,
      escapeRate: 2,
      detectionRate: 95,
      blockedRate: 3,
      totalTests: 1200,
    });

    const trends = service.getTrends(1, 'day');
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0].pass_rate).toBeCloseTo(85.5);
  });

  it('updates snapshot for the same day', () => {
    service.init();

    service.saveSnapshot(1, { passRate: 80 });
    service.saveSnapshot(1, { passRate: 90 });

    const trends = service.getTrends(1, 'day');
    expect(trends.length).toBe(1);
    expect(trends[0].pass_rate).toBeCloseTo(90);
  });

  it('returns trends grouped by week', () => {
    service.init();

    service.saveSnapshot(1, { passRate: 80 });
    const trends = service.getTrends(1, 'week');
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]).toHaveProperty('period');
  });

  it('returns trends grouped by month', () => {
    service.init();

    service.saveSnapshot(1, { passRate: 80 });
    const trends = service.getTrends(1, 'month');
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]).toHaveProperty('period');
  });

  it('purges old snapshots', () => {
    service.init();

    // Insert old snapshot manually
    service.db
      .prepare(
        `
      INSERT INTO metric_snapshots (project_id, date, pass_rate)
      VALUES (1, '2020-01-01', 50)
    `
      )
      .run();

    service.purgeOld();

    const remaining = service.db.prepare('SELECT COUNT(*) as count FROM metric_snapshots').get();
    expect(remaining.count).toBe(0);
  });
});
