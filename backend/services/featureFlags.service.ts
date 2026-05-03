import crypto from 'crypto';
import syncHistoryService from './syncHistory.service';
import webhooksService from './webhooks.service';
import logger from './logger.service';

class FeatureFlagsService {
  _db() {
    if (!syncHistoryService._initialized) syncHistoryService.initDb();
    return syncHistoryService.db;
  }

  /**
   * Notifie les webhooks d'un changement de feature flag.
   * @private
   */
  _notifyChange(key: any, action: any, extra = {}) {
    try {
      webhooksService.trigger('feature-flag.changed', { key, action, ...extra });
    } catch (err: any) {
      logger.error('FeatureFlags: webhook notify error', err.message);
    }
  }

  /**
   * Génère un hash déterministe entre 0 et 99 pour un couple (key, userId).
   * Le résultat est sticky : même user → même résultat pour un flag donné.
   * @private
   */
  _hashUserFlag(key: any, userId: any) {
    const hash = crypto.createHash('sha256').update(`${key}:${userId}`).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % 100;
  }

  /**
   * Détermine si un flag est actif pour un utilisateur donné en respectant le rollout %.
   * @param {string} key
   * @param {string} userId
   * @param {boolean} defaultValue
   * @returns {boolean}
   */
  isEnabledForUser(key: any, userId: any, defaultValue = false) {
    const db = this._db();
    if (!db) return defaultValue;
    try {
      const row = db.prepare('SELECT enabled, rollout_percentage FROM feature_flags WHERE key = ?').get(key);
      if (!row) return defaultValue;
      if (!row.enabled) return false;
      const rollout = row.rollout_percentage ?? 100;
      if (rollout >= 100) return true;
      if (!userId) return false; // si rollout partiel mais pas d'userId → safe default
      const userHash = this._hashUserFlag(key, userId);
      return userHash < rollout;
    } catch (err: any) {
      logger.error(`FeatureFlags: isEnabledForUser(${key}, ${userId}) error`, err.message);
      return defaultValue;
    }
  }

  /**
   * Retourne tous les flags sous forme d'objet { [key]: boolean }.
   * Format rétrocompatible pour les consumers.
   * @param {string} [userId] - Si fourni, applique le rollout progressif par utilisateur.
   */
  getAll(userId: any) {
    const db = this._db();
    if (!db) return {};
    try {
      const rows = db.prepare('SELECT key, enabled, rollout_percentage FROM feature_flags').all();
      const result: any = {};
      for (const row of rows) {
        if (!row.enabled) {
          result[row.key] = false;
          continue;
        }
        const rollout = row.rollout_percentage ?? 100;
        if (rollout >= 100) {
          result[row.key] = true;
        } else if (userId) {
          result[row.key] = this._hashUserFlag(row.key, userId) < rollout;
        } else {
          result[row.key] = false; // rollout partiel sans userId → safe default
        }
      }
      return result;
    } catch (err: any) {
      logger.error('FeatureFlags: getAll error', err.message);
      return {};
    }
  }

  /**
   * Retourne tous les flags avec leurs métadonnées complètes.
   * @returns {Array<{key, enabled, description, rolloutPercentage, updatedAt, createdAt}>}
   */
  getAllDetails() {
    const db = this._db();
    if (!db) return [];
    try {
      const rows = db
        .prepare(
          'SELECT key, enabled, description, rollout_percentage, updated_at, created_at FROM feature_flags ORDER BY key'
        )
        .all();
      return rows.map((row: any) => ({
        key: row.key,
        enabled: Boolean(row.enabled),
        description: row.description || '',
        rolloutPercentage: row.rollout_percentage,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      }));
    } catch (err: any) {
      logger.error('FeatureFlags: getAllDetails error', err.message);
      return [];
    }
  }

  /**
   * Retourne l'état d'un flag spécifique.
   * Rétrocompatible : sans userId, retourne le booléen brut (100% ou 0%).
   * @param {string} key
   * @param {boolean} defaultValue
   * @param {string} [userId]
   */
  isEnabled(key: any, defaultValue = false, userId = null) {
    if (userId) {
      return this.isEnabledForUser(key, userId, defaultValue);
    }
    const db = this._db();
    if (!db) return defaultValue;
    try {
      const row = db.prepare('SELECT enabled FROM feature_flags WHERE key = ?').get(key);
      return row ? Boolean(row.enabled) : defaultValue;
    } catch (err: any) {
      logger.error(`FeatureFlags: isEnabled(${key}) error`, err.message);
      return defaultValue;
    }
  }

  /**
   * Retourne le détail complet d'un flag.
   * @param {string} key
   * @returns {Object|null}
   */
  getByKey(key: any) {
    const db = this._db();
    if (!db) return null;
    try {
      const row = db
        .prepare(
          'SELECT key, enabled, description, rollout_percentage, updated_at, created_at FROM feature_flags WHERE key = ?'
        )
        .get(key);
      if (!row) return null;
      return {
        key: row.key,
        enabled: Boolean(row.enabled),
        description: row.description || '',
        rolloutPercentage: row.rollout_percentage,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      };
    } catch (err: any) {
      logger.error(`FeatureFlags: getByKey(${key}) error`, err.message);
      return null;
    }
  }

  /**
   * Crée un nouveau flag.
   * @param {string} key
   * @param {Object} options
   * @param {boolean} options.enabled
   * @param {string} [options.description]
   * @param {number} [options.rolloutPercentage]
   */
  create(key: any, { enabled = false, description = '', rolloutPercentage = 100 } = {} as any) {
    const db = this._db();
    if (!db) return false;
    try {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO feature_flags (key, enabled, description, rollout_percentage, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(key, enabled ? 1 : 0, description, rolloutPercentage, now, now);
      logger.info(`FeatureFlags: created ${key} → enabled=${enabled}, rollout=${rolloutPercentage}%`);
      this._notifyChange(key, 'created', { enabled, rolloutPercentage });
      return true;
    } catch (err: any) {
      logger.error(`FeatureFlags: create(${key}) error`, err.message);
      return false;
    }
  }

  /**
   * Met à jour un flag existant.
   * @param {string} key
   * @param {Object} options
   * @param {boolean} [options.enabled]
   * @param {string} [options.description]
   * @param {number} [options.rolloutPercentage]
   */
  update(key: any, { enabled, description, rolloutPercentage }: any = {}) {
    const db = this._db();
    if (!db) return false;
    try {
      const existing = db.prepare('SELECT 1 FROM feature_flags WHERE key = ?').get(key);
      if (!existing) return false;

      const sets = ['updated_at = ?'];
      const values: any[] = [new Date().toISOString()];

      if (typeof enabled === 'boolean') {
        sets.push('enabled = ?');
        values.push(enabled ? 1 : 0);
      }
      if (typeof description === 'string') {
        sets.push('description = ?');
        values.push(description);
      }
      if (typeof rolloutPercentage === 'number') {
        sets.push('rollout_percentage = ?');
        values.push(rolloutPercentage);
      }

      values.push(key);
      db.prepare(`UPDATE feature_flags SET ${sets.join(', ')} WHERE key = ?`).run(...values);
      logger.info(`FeatureFlags: updated ${key}`);
      this._notifyChange(key, 'updated', { enabled, rolloutPercentage });
      return true;
    } catch (err: any) {
      logger.error(`FeatureFlags: update(${key}) error`, err.message);
      return false;
    }
  }

  /**
   * Supprime un flag.
   * @param {string} key
   */
  delete(key: any) {
    const db = this._db();
    if (!db) return false;
    try {
      const result = db.prepare('DELETE FROM feature_flags WHERE key = ?').run(key);
      const success = result.changes > 0;
      if (success) {
        logger.info(`FeatureFlags: deleted ${key}`);
        this._notifyChange(key, 'deleted');
      }
      return success;
    } catch (err: any) {
      logger.error(`FeatureFlags: delete(${key}) error`, err.message);
      return false;
    }
  }

  /**
   * Active ou désactive un flag (shortcut rétrocompatible).
   * Fait un UPSERT pour garantir la rétrocompatibilité.
   * @param {string} key
   * @param {boolean} enabled
   */
  set(key: any, enabled: any) {
    const db = this._db();
    if (!db) return false;
    try {
      db.prepare(
        `
        INSERT INTO feature_flags (key, enabled, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `
      ).run(key, enabled ? 1 : 0, new Date().toISOString());
      logger.info(`FeatureFlags: ${key} → ${enabled}`);
      this._notifyChange(key, 'set', { enabled });
      return true;
    } catch (err: any) {
      logger.error(`FeatureFlags: set(${key}) error`, err.message);
      return false;
    }
  }
}

export default new FeatureFlagsService();
