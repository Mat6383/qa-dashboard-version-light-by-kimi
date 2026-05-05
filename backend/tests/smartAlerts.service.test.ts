import smartAlertsService from '../services/smartAlerts.service';
import analyticsService from '../services/analytics.service';
import metricSnapshotsService from '../services/metricSnapshots.service';

describe('SmartAlertsService', () => {
  const PROJECT_ID = 42;

  beforeAll(() => {
    analyticsService.init();
    metricSnapshotsService.init();
  });

  beforeEach(() => {
    analyticsService.db.prepare('DELETE FROM analytics_insights').run();
    metricSnapshotsService.db.prepare('DELETE FROM metric_snapshots').run();
  });

  function insertSnapshot(
    date: string,
    passRate: number,
    completionRate: number,
    totalTests: number,
    escapeRate = 5,
    blockedRate = 2,
    detectionRate = 90
  ) {
    metricSnapshotsService.db.prepare(`
      INSERT INTO metric_snapshots (project_id, date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(PROJECT_ID, date, passRate, completionRate, escapeRate, detectionRate, blockedRate, totalTests);
  }

  test('retourne vide si moins de 3 snapshots', () => {
    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    expect(insights).toHaveLength(0);
  });

  test('detecte une regression de pass rate', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    insertSnapshot(twoDaysAgo, 95, 50, 100);
    insertSnapshot(yesterday, 90, 55, 100);
    insertSnapshot(today, 75, 60, 100); // drop de 15 pts

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const regression = insights.find((i) => i.data?.subtype === 'regression');
    expect(regression).toBeDefined();
    expect(regression!.title).toBe('Regression Detected');
    expect(regression!.data?.severity).toBe('medium');
    expect(regression!.confidence).toBeGreaterThan(0.7);
  });

  test('detecte une regression severe (high)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    insertSnapshot(twoDaysAgo, 95, 50, 100);
    insertSnapshot(yesterday, 80, 55, 100);
    insertSnapshot(today, 55, 60, 100); // drop de 25 pts

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const regression = insights.find((i) => i.data?.subtype === 'regression');
    expect(regression).toBeDefined();
    expect(regression!.data?.severity).toBe('high');
  });

  test('predicte une date de fin', () => {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const completion = 30 + (6 - i) * 5; // progrès de 5% par jour
      insertSnapshot(date, 80, completion, 100);
    }

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const prediction = insights.find((i) => i.data?.subtype === 'end_date_prediction');
    expect(prediction).toBeDefined();
    expect(prediction!.title).toBe('End Date Prediction');
    expect(prediction!.data?.predicted_end_date).toBeDefined();
  });

  test('detecte un projet bloque (stalled)', () => {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      insertSnapshot(date, 80, 45, 100); // pas de progression
    }

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const stalled = insights.find((i) => i.data?.subtype === 'end_date_prediction');
    expect(stalled).toBeDefined();
    expect(stalled!.title).toBe('Stalled Progress');
  });

  test('detecte un seuil adaptatif bas', () => {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const pass = i === 0 ? 40 : 90; // le dernier est très bas
      insertSnapshot(date, pass, 50, 100);
    }

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const threshold = insights.find((i) => i.data?.subtype === 'adaptive_threshold');
    expect(threshold).toBeDefined();
    expect(threshold!.title).toBe('Pass Rate Below Adaptive Threshold');
    expect(threshold!.data?.direction).toBe('below');
  });

  test('detecte un seuil adaptatif haut', () => {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const pass = i === 0 ? 99 : 60; // le dernier est très haut
      insertSnapshot(date, pass, 50, 100);
    }

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const threshold = insights.find((i) => i.data?.subtype === 'adaptive_threshold');
    expect(threshold).toBeDefined();
    expect(threshold!.title).toBe('Pass Rate Above Adaptive Threshold');
    expect(threshold!.data?.direction).toBe('above');
  });

  test('deduplique les insights par sous-type sur 24h', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    insertSnapshot(twoDaysAgo, 95, 50, 100);
    insertSnapshot(yesterday, 90, 55, 100);
    insertSnapshot(today, 75, 60, 100);

    const first = smartAlertsService.analyzeProject(PROJECT_ID);
    expect(first.length).toBeGreaterThanOrEqual(1);

    const second = smartAlertsService.analyzeProject(PROJECT_ID);
    expect(second).toHaveLength(0); // déjà inséré dans les dernières 24h
  });

  test('pas de regression si la tendance est stable', () => {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      insertSnapshot(date, 80, 50, 100);
    }

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const regression = insights.find((i) => i.data?.subtype === 'regression');
    expect(regression).toBeUndefined();
  });

  test('pas de seuil adaptatif si stdev est nulle', () => {
    for (let i = 2; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      insertSnapshot(date, 80, 50, 100); // tous identiques
    }

    const insights = smartAlertsService.analyzeProject(PROJECT_ID);
    const threshold = insights.find((i) => i.data?.subtype === 'adaptive_threshold');
    expect(threshold).toBeUndefined();
  });
});
