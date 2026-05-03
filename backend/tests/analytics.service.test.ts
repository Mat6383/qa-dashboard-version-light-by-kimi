import analyticsService from '../services/analytics.service';
import metricSnapshotsService from '../services/metricSnapshots.service';

describe('AnalyticsService', () => {
  beforeAll(() => {
    analyticsService.init();
    metricSnapshotsService.init();
  });

  beforeEach(() => {
    analyticsService.db.prepare('DELETE FROM analytics_insights').run();
    metricSnapshotsService.db.prepare('DELETE FROM metric_snapshots').run();
  });

  test('createInsight et getInsights', () => {
    const insight = analyticsService.createInsight({
      project_id: 1,
      type: 'recommendation',
      title: 'Test',
      message: 'Message test',
      confidence: 0.9,
      data: { foo: 'bar' },
    });

    expect(insight.id).toBeDefined();
    expect(insight.title).toBe('Test');

    const insights = analyticsService.getInsights(1);
    expect(insights).toHaveLength(1);
    expect(insights[0].read).toBe(false);
    expect(insights[0].data).toEqual({ foo: 'bar' });
  });

  test('markAsRead', () => {
    const insight = analyticsService.createInsight({
      project_id: 1, type: 'trend', title: 'T', message: 'M',
    });
    analyticsService.markAsRead(insight.id);
    const list = analyticsService.getInsights(1);
    expect(list[0].read).toBe(true);
  });

  test('markAllAsRead par projet', () => {
    analyticsService.createInsight({ project_id: 1, type: 'trend', title: 'A', message: 'M' });
    analyticsService.createInsight({ project_id: 2, type: 'trend', title: 'B', message: 'M' });
    analyticsService.markAllAsRead(1);
    expect(analyticsService.getInsights(1)[0].read).toBe(true);
    expect(analyticsService.getInsights(2)[0].read).toBe(false);
  });

  test('deleteOld supprime les insights lus anciens', () => {
    analyticsService.db.prepare(`
      INSERT INTO analytics_insights (project_id, type, title, message, read, created_at)
      VALUES (1, 'trend', 'Old', 'M', 1, datetime('now', '-200 days'))
    `).run();
    const count = analyticsService.deleteOld(180);
    expect(count).toBe(1);
  });

  test('analyzeProject génère des insights sur historique', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 10; i++) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      metricSnapshotsService.db.prepare(`
        INSERT INTO metric_snapshots (project_id, date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests)
        VALUES (99, ?, 80, 70, 5, 90, 2, 100)
      `).run(date);
    }

    const insights = analyticsService.analyzeProject(99);
    expect(Array.isArray(insights)).toBe(true);
  });

  test('analyzeProject retourne vide si pas assez d historique', () => {
    const insights = analyticsService.analyzeProject(999);
    expect(insights).toHaveLength(0);
  });
});
