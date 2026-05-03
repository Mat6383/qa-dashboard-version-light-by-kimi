import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.service';
import { run as runMigrations } from '../db/migrate';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

class MetricSnapshotsService {
  db: any;

  constructor() {
    this.db = null;
  }

  init() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    runMigrations(this.db, 'sync-history');
    logger.info('[MetricSnapshotsService] Initialisé');
  }

  /**
   * Enregistre un snapshot quotidien pour un projet
   */
  saveSnapshot(projectId: any, metrics: any) {
    const today = new Date().toISOString().slice(0, 10);
    const stmt = this.db.prepare(`
      INSERT INTO metric_snapshots (project_id, date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, date) DO UPDATE SET
        pass_rate = excluded.pass_rate,
        completion_rate = excluded.completion_rate,
        escape_rate = excluded.escape_rate,
        detection_rate = excluded.detection_rate,
        blocked_rate = excluded.blocked_rate,
        total_tests = excluded.total_tests,
        created_at = datetime('now')
    `);
    stmt.run(
      projectId,
      today,
      metrics.passRate ?? null,
      metrics.completionRate ?? null,
      metrics.escapeRate ?? null,
      metrics.detectionRate ?? null,
      metrics.blockedRate ?? null,
      metrics.totalTests ?? null
    );
    logger.info(`[MetricSnapshotsService] Snapshot enregistré pour projet ${projectId}`);
  }

  /**
   * Récupère les tendances sur une période
   */
  getTrends(projectId: any, granularity = 'day', from: any, to: any) {
    const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    let dateSelect, groupBy;
    if (granularity === 'week') {
      dateSelect = "strftime('%Y-W%W', date)";
      groupBy = "strftime('%Y-W%W', date)";
    } else if (granularity === 'month') {
      dateSelect = "strftime('%Y-%m', date)";
      groupBy = "strftime('%Y-%m', date)";
    } else {
      dateSelect = 'date';
      groupBy = 'date';
    }

    const stmt = this.db.prepare(`
      SELECT
        ${dateSelect} as period,
        AVG(pass_rate) as pass_rate,
        AVG(completion_rate) as completion_rate,
        AVG(escape_rate) as escape_rate,
        AVG(detection_rate) as detection_rate,
        AVG(blocked_rate) as blocked_rate,
        SUM(total_tests) as total_tests
      FROM metric_snapshots
      WHERE project_id = ? AND date >= ? AND date <= ?
      GROUP BY ${groupBy}
      ORDER BY MIN(date)
    `);

    return stmt.all(projectId, fromDate, toDate);
  }

  /**
   * Purge les snapshots anciens (> 2 ans)
   */
  purgeOld() {
    const cutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const stmt = this.db.prepare('DELETE FROM metric_snapshots WHERE date < ?');
    const result = stmt.run(cutoff);
    if (result.changes > 0) {
      logger.info(`[MetricSnapshotsService] ${result.changes} snapshots supprimés (< ${cutoff})`);
    }
  }
}

export default new MetricSnapshotsService();
