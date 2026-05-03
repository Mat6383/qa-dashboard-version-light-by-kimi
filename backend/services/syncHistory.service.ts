import path from 'path';
import Database from 'better-sqlite3';
import logger from './logger.service';
import { run } from '../db/migrate';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

class SyncHistoryService {
  db: any;
  _initialized: boolean;

  constructor() {
    this.db = null;
    this._initialized = false;
  }

  /**
   * Initialise la base SQLite et crée la table si elle n'existe pas.
   */
  initDb() {
    if (this._initialized) return;

    try {
      this.db = new Database(DB_PATH);

      // WAL mode : meilleure durabilité et performance en lecture concurrente
      // (ITIL Availability Management — résiste aux arrêts brutaux)
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');

      run(this.db, 'sync-history');

      this._initialized = true;
      logger.info('SyncHistory: Base SQLite initialisée → ' + DB_PATH);
    } catch (err: any) {
      logger.error('SyncHistory: Impossible d\'initialiser SQLite:', err.message);
    }
  }

  /**
   * Insère un enregistrement de run de synchronisation.
   *
   * @param {string} projectName   - Nom du projet (ex: "Neo-Pilot")
   * @param {string} iterationName - Nom de l'itération (ex: "R14 - run 1")
   * @param {string} mode          - 'preview' ou 'execute'
   * @param {Object} results       - { created, updated, skipped, enriched, errors, total }
   * @returns {number|null} ID de la ligne insérée, ou null en cas d'erreur
   */
  addRun(projectName: any, iterationName: any, mode: any, results: any = {}) {
    if (!this._initialized) this.initDb();
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_runs
          (project_name, iteration_name, mode, created, updated, skipped, enriched, errors, total_issues, executed_at)
        VALUES
          (@project_name, @iteration_name, @mode, @created, @updated, @skipped, @enriched, @errors, @total_issues, @executed_at)
      `);

      const info = stmt.run({
        project_name:   projectName,
        iteration_name: iterationName,
        mode,
        created:        results.created   || 0,
        updated:        results.updated   || 0,
        skipped:        results.skipped   || 0,
        enriched:       results.enriched  || 0,
        errors:         results.errors    || 0,
        total_issues:   results.total     || 0,
        executed_at:    new Date().toISOString()
      });

      logger.info(`SyncHistory: run ${info.lastInsertRowid} enregistré (${projectName} / ${iterationName} / ${mode})`);
      return info.lastInsertRowid;
    } catch (err: any) {
      logger.error('SyncHistory: Erreur insertion:', err.message);
      return null;
    }
  }

  /**
   * Retourne les derniers runs, du plus récent au plus ancien.
   *
   * @param {number} limit - Nombre max de résultats (défaut 50)
   * @returns {Array}
   */
  getHistory(limit = 50) {
    if (!this._initialized) this.initDb();
    if (!this.db) return [];

    try {
      const rows = this.db
        .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?')
        .all(limit);
      return rows;
    } catch (err: any) {
      logger.error('SyncHistory: Erreur lecture historique:', err.message);
      return [];
    }
  }
}

export default new SyncHistoryService();
