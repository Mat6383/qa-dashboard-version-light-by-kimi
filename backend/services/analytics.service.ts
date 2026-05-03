import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.service';
import { run as runMigrations } from '../db/migrate';
import metricSnapshotsService from './metricSnapshots.service';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

interface InsightInput {
  project_id: number;
  type: 'trend' | 'pattern' | 'recommendation' | 'anomaly';
  title: string;
  message: string;
  confidence?: number;
  data?: Record<string, unknown>;
}

class AnalyticsService {
  db: any;

  constructor() {
    this.db = null;
  }

  init() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    runMigrations(this.db, 'analytics');
    logger.info('[AnalyticsService] Initialisé');
  }

  ensureDb() {
    if (!this.db) this.init();
  }

  createInsight(input: InsightInput) {
    this.ensureDb();
    const stmt = this.db.prepare(`
      INSERT INTO analytics_insights (project_id, type, title, message, confidence, data_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.project_id,
      input.type,
      input.title,
      input.message,
      input.confidence ?? 0.8,
      input.data ? JSON.stringify(input.data) : null
    );
    return { id: result.lastInsertRowid, ...input };
  }

  getInsights(projectId?: number, unreadOnly = false, limit = 50) {
    this.ensureDb();
    let sql = 'SELECT * FROM analytics_insights WHERE 1=1';
    const params: any[] = [];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    if (unreadOnly) {
      sql += ' AND read = 0';
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r: any) => ({
      ...r,
      data: r.data_json ? JSON.parse(r.data_json) : null,
      read: !!r.read,
    }));
  }

  markAsRead(id: number) {
    this.ensureDb();
    const stmt = this.db.prepare('UPDATE analytics_insights SET read = 1 WHERE id = ?');
    stmt.run(id);
  }

  markAllAsRead(projectId?: number) {
    this.ensureDb();
    let sql = 'UPDATE analytics_insights SET read = 1';
    const params: any[] = [];
    if (projectId) {
      sql += ' WHERE project_id = ?';
      params.push(projectId);
    }
    this.db.prepare(sql).run(...params);
  }

  deleteOld(days: number) {
    this.ensureDb();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare("DELETE FROM analytics_insights WHERE created_at < ? AND read = 1");
    const result = stmt.run(cutoff);
    logger.info(`[AnalyticsService] ${result.changes} insights lus supprimés (< ${cutoff})`);
    return result.changes;
  }

  /**
   * Analyse les métriques historiques d'un projet et génère des insights IA
   */
  analyzeProject(projectId: number) {
    this.ensureDb();
    if (!metricSnapshotsService.db) metricSnapshotsService.init();

    const rows = metricSnapshotsService.db.prepare(`
      SELECT date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests
      FROM metric_snapshots
      WHERE project_id = ?
      ORDER BY date ASC
    `).all(projectId);

    if (rows.length < 7) {
      logger.info(`[AnalyticsService] Pas assez d'historique pour analyser le projet ${projectId}`);
      return [];
    }

    const insights: InsightInput[] = [];
    const latest = rows[rows.length - 1];
    const previous = rows[rows.length - 8] || rows[0];

    // Trend: pass rate drop
    const passDiff = latest.pass_rate - previous.pass_rate;
    if (passDiff < -5) {
      insights.push({
        project_id: projectId,
        type: 'trend',
        title: 'Baisse du Pass Rate',
        message: `Le taux de réussite a chuté de ${Math.abs(passDiff).toFixed(1)} points sur 7 jours (de ${previous.pass_rate}% à ${latest.pass_rate}%).`,
        confidence: Math.min(0.99, 0.7 + Math.abs(passDiff) / 20),
        data: { metric: 'pass_rate', before: previous.pass_rate, after: latest.pass_rate, diff: passDiff },
      });
    }

    // Trend: completion rate stagnation
    const compDiff = latest.completion_rate - previous.completion_rate;
    if (compDiff < 1 && latest.completion_rate < 80) {
      insights.push({
        project_id: projectId,
        type: 'pattern',
        title: 'Stagnation de la complétion',
        message: `Le taux de complétion reste faible (${latest.completion_rate}%) sans amélioration significative.`,
        confidence: 0.75,
        data: { metric: 'completion_rate', value: latest.completion_rate },
      });
    }

    // Pattern: high blocked rate
    if (latest.blocked_rate > 5) {
      insights.push({
        project_id: projectId,
        type: 'pattern',
        title: 'Taux de blocage élevé',
        message: `${latest.blocked_rate}% des tests sont bloqués. Cela peut indiquer des dépendances externes ou des environnements instables.`,
        confidence: 0.85,
        data: { metric: 'blocked_rate', value: latest.blocked_rate },
      });
    }

    // Recommendation: increase coverage if low
    if (latest.total_tests < 50 && latest.completion_rate > 90) {
      insights.push({
        project_id: projectId,
        type: 'recommendation',
        title: 'Augmenter la couverture de tests',
        message: `Avec seulement ${latest.total_tests} tests et une bonne complétion (${latest.completion_rate}%), vous pourriez étendre la couverture fonctionnelle.`,
        confidence: 0.7,
        data: { total_tests: latest.total_tests, completion_rate: latest.completion_rate },
      });
    }

    // Anomaly: escape rate spike
    const escapeDiff = latest.escape_rate - previous.escape_rate;
    if (escapeDiff > 3) {
      insights.push({
        project_id: projectId,
        type: 'anomaly',
        title: 'Pic du taux d\'échappement',
        message: `Le taux d'échappement a augmenté de ${escapeDiff.toFixed(1)} points. Vérifiez les régressions récentes.`,
        confidence: 0.8,
        data: { metric: 'escape_rate', before: previous.escape_rate, after: latest.escape_rate },
      });
    }

    // Save insights
    const saved: any[] = [];
    for (const insight of insights) {
      try {
        saved.push(this.createInsight(insight));
      } catch (e: any) {
        logger.warn('[AnalyticsService] Échec création insight:', e.message);
      }
    }

    logger.info(`[AnalyticsService] ${saved.length} insights générés pour projet ${projectId}`);
    return saved;
  }
}

export default new AnalyticsService();
