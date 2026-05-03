import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.service';
import { run as runMigrations } from '../db/migrate';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

interface RetentionPolicy {
  id?: number;
  entity_type: string;
  retention_days: number;
  auto_archive: boolean;
  auto_delete: boolean;
}

class RetentionService {
  db: any;

  constructor() {
    this.db = null;
  }

  init() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    runMigrations(this.db, 'retention');
    logger.info('[RetentionService] Initialisé');
  }

  ensureDb() {
    if (!this.db) this.init();
  }

  getPolicies() {
    this.ensureDb();
    const stmt = this.db.prepare('SELECT * FROM retention_policies ORDER BY entity_type');
    const rows = stmt.all();
    return rows.map((r: any) => ({
      ...r,
      auto_archive: !!r.auto_archive,
      auto_delete: !!r.auto_delete,
    }));
  }

  updatePolicy(entityType: string, updates: Partial<RetentionPolicy>) {
    this.ensureDb();
    const sets: string[] = [];
    const params: any[] = [];
    if (updates.retention_days !== undefined) {
      sets.push('retention_days = ?');
      params.push(updates.retention_days);
    }
    if (updates.auto_archive !== undefined) {
      sets.push('auto_archive = ?');
      params.push(updates.auto_archive ? 1 : 0);
    }
    if (updates.auto_delete !== undefined) {
      sets.push('auto_delete = ?');
      params.push(updates.auto_delete ? 1 : 0);
    }
    if (sets.length === 0) return null;
    sets.push("updated_at = datetime('now')");
    params.push(entityType);
    const stmt = this.db.prepare(`UPDATE retention_policies SET ${sets.join(', ')} WHERE entity_type = ?`);
    stmt.run(...params);
    return this.getPolicies().find((p: any) => p.entity_type === entityType);
  }

  getArchives(entityType?: string, limit = 100) {
    this.ensureDb();
    let sql = 'SELECT * FROM archived_snapshots WHERE 1=1';
    const params: any[] = [];
    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }
    sql += ' ORDER BY archived_at DESC LIMIT ?';
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r: any) => ({
      ...r,
      data: r.data_json ? JSON.parse(r.data_json) : null,
    }));
  }

  /**
   * Archive les données d'une table selon la politique
   */
  archiveEntity(entityType: string, retentionDays: number) {
    this.ensureDb();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let tableName: string;
    let idColumn: string;
    let projectColumn: string | null = null;
    let dateColumn: string;

    switch (entityType) {
      case 'metric_snapshots':
        tableName = 'metric_snapshots';
        idColumn = 'id';
        projectColumn = 'project_id';
        dateColumn = 'date';
        break;
      case 'sync_history':
        tableName = 'sync_history';
        idColumn = 'id';
        projectColumn = 'project_id';
        dateColumn = 'started_at';
        break;
      case 'audit_logs':
        tableName = 'audit_logs';
        idColumn = 'id';
        projectColumn = null;
        dateColumn = 'created_at';
        break;
      case 'analytics_insights':
        tableName = 'analytics_insights';
        idColumn = 'id';
        projectColumn = 'project_id';
        dateColumn = 'created_at';
        break;
      default:
        throw new Error(`Type d'entité inconnu: ${entityType}`);
    }

    const selectSql = projectColumn
      ? `SELECT ${idColumn} as id, ${projectColumn} as project_id, * FROM ${tableName} WHERE ${dateColumn} < ?`
      : `SELECT ${idColumn} as id, * FROM ${tableName} WHERE ${dateColumn} < ?`;

    const rows = this.db.prepare(selectSql).all(cutoff);
    if (rows.length === 0) return { archived: 0, deleted: 0 };

    const insertStmt = this.db.prepare(`
      INSERT INTO archived_snapshots (entity_type, entity_id, project_id, data_json, archived_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    const archiveTransaction = this.db.transaction((dataRows: any[]) => {
      for (const row of dataRows) {
        insertStmt.run(
          entityType,
          String(row.id),
          projectColumn ? row.project_id : null,
          JSON.stringify(row)
        );
      }
    });

    archiveTransaction(rows);

    const deleteStmt = this.db.prepare(`DELETE FROM ${tableName} WHERE ${dateColumn} < ?`);
    const delResult = deleteStmt.run(cutoff);

    logger.info(`[RetentionService] ${entityType}: ${rows.length} archivés, ${delResult.changes} supprimés (< ${cutoff})`);
    return { archived: rows.length, deleted: delResult.changes };
  }

  runRetentionCycle() {
    this.ensureDb();
    const policies = this.getPolicies();
    const results: any[] = [];
    for (const policy of policies) {
      if (!policy.auto_archive && !policy.auto_delete) continue;
      try {
        if (policy.auto_archive) {
          const r = this.archiveEntity(policy.entity_type, policy.retention_days);
          results.push({ entity_type: policy.entity_type, ...r });
        }
      } catch (e: any) {
        logger.error(`[RetentionService] Échec rétention ${policy.entity_type}:`, e.message);
        results.push({ entity_type: policy.entity_type, error: e.message });
      }
    }
    return results;
  }
}

export default new RetentionService();
