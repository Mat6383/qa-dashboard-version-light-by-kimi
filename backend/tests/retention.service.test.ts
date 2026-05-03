import retentionService from '../services/retention.service';

describe('RetentionService', () => {
  beforeAll(() => {
    retentionService.init();
  });

  beforeEach(() => {
    retentionService.db.prepare('DELETE FROM archived_snapshots').run();
    retentionService.db.prepare('DELETE FROM retention_policies').run();
    retentionService.db.prepare(`
      INSERT INTO retention_policies (entity_type, retention_days, auto_archive, auto_delete)
      VALUES ('sync_history', 90, 1, 0),
             ('metric_snapshots', 730, 1, 0)
    `).run();
  });

  test('getPolicies retourne les politiques', () => {
    const policies = retentionService.getPolicies();
    expect(policies.length).toBeGreaterThanOrEqual(2);
    expect(policies[0].entity_type).toBeDefined();
  });

  test('updatePolicy modifie une politique', () => {
    retentionService.updatePolicy('sync_history', { retention_days: 30, auto_archive: false });
    const p = retentionService.getPolicies().find((x: any) => x.entity_type === 'sync_history');
    expect(p.retention_days).toBe(30);
    expect(p.auto_archive).toBe(false);
  });

  test('archiveEntity archive et supprime les vieilles métriques', () => {
    retentionService.db.prepare(`
      INSERT INTO metric_snapshots (project_id, date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests)
      VALUES (1, date('now', '-800 days'), 50, 50, 0, 0, 0, 10)
    `).run();

    const result = retentionService.archiveEntity('metric_snapshots', 730);
    expect(result.archived).toBe(1);
    expect(result.deleted).toBe(1);

    const archives = retentionService.getArchives('metric_snapshots');
    expect(archives.length).toBe(1);
    expect(archives[0].data).toBeDefined();
  });

  test('runRetentionCycle exécute le cycle complet', () => {
    retentionService.db.prepare(`
      INSERT INTO metric_snapshots (project_id, date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests)
      VALUES (1, date('now', '-800 days'), 50, 50, 0, 0, 0, 10)
    `).run();

    const results = retentionService.runRetentionCycle();
    const metricResult = results.find((r: any) => r.entity_type === 'metric_snapshots');
    expect(metricResult.archived).toBeGreaterThanOrEqual(1);
  });
});
