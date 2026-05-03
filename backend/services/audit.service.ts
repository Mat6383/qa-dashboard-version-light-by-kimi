import path from 'path';
import Database from 'better-sqlite3';
import logger, { redactSensitive } from './logger.service';
import { run } from '../db/migrate';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

class AuditService {
  db: any;
  _initialized: boolean;

  constructor() {
    this.db = null;
    this._initialized = false;
  }

  /**
   * Initialise la base SQLite.
   */
  init() {
    if (this._initialized) return;

    try {
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');

      run(this.db, 'audit');

      this._initialized = true;
      logger.info('AuditService: Base SQLite initialisée → ' + DB_PATH);
    } catch (err: any) {
      logger.error("AuditService: Impossible d'initialiser SQLite:", err.message);
    }
  }

  /**
   * Enregistre une entrée d'audit.
   * @param {Object} params
   */
  log(params: any) {
    if (!this.db) this.init();
    if (!this.db) return;

    try {
      const details = params.details ? JSON.stringify(redactSensitive(params.details)) : null;

      const stmt = this.db.prepare(`
        INSERT INTO audit_log
        (timestamp, actor_id, actor_email, actor_role, action, resource, resource_id,
         method, path, ip, user_agent, status_code, details, success)
        VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        params.actorId ?? null,
        params.actorEmail ?? null,
        params.actorRole ?? null,
        params.action,
        params.resource ?? null,
        params.resourceId ?? null,
        params.method ?? null,
        params.path ?? null,
        params.ip ?? null,
        params.userAgent ?? null,
        params.statusCode ?? null,
        details,
        params.success !== undefined ? (params.success ? 1 : 0) : 1
      );
    } catch (err: any) {
      logger.error("AuditService: Erreur lors de l'insertion:", err.message);
    }
  }

  /**
   * Requête paginée avec filtres.
   * @param {Object} filters
   * @returns {{ data: Array, total: number, limit: number, offset: number }}
   */
  query(filters: any = {}) {
    if (!this.db) this.init();
    if (!this.db) return { data: [], total: 0, limit: filters.limit || 50, offset: filters.offset || 0 };

    const { action, actorId, from, to, limit = 50, offset = 0 } = filters;
    const conditions = [];
    const values = [];

    if (action) {
      conditions.push('action = ?');
      values.push(action);
    }
    if (actorId) {
      conditions.push('actor_id = ?');
      values.push(actorId);
    }
    if (from) {
      conditions.push('timestamp >= ?');
      values.push(from);
    }
    if (to) {
      conditions.push('timestamp <= ?');
      values.push(to);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM audit_log ${where}`);
    const { total } = countStmt.get(...values);

    const dataStmt = this.db.prepare(`
      SELECT * FROM audit_log
      ${where}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...values, limit, offset).map((row: any) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
      success: row.success === 1,
    }));

    return { data, total, limit, offset };
  }

  /**
   * Supprime les entrées plus anciennes que N jours.
   * @param {number} retentionDays
   */
  prune(retentionDays = 90) {
    if (!this.db) this.init();
    if (!this.db) return;

    try {
      const stmt =
        retentionDays <= 0
          ? this.db.prepare('DELETE FROM audit_log')
          : this.db.prepare(`DELETE FROM audit_log WHERE timestamp < datetime('now', '-${retentionDays} days')`);
      const result = stmt.run();
      if (result.changes > 0) {
        logger.info(`AuditService: ${result.changes} entrées supprimées (rétention ${retentionDays} jours)`);
      }
    } catch (err: any) {
      logger.error('AuditService: Erreur lors du pruning:', err.message);
    }
  }
}

export default new AuditService();
