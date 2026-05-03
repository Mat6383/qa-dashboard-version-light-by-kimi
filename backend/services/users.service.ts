import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.service';
import { run as runMigrations } from '../db/migrate';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

class UsersService {
  db: any;

  constructor() {
    this.db = null;
  }

  init() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    runMigrations(this.db, 'auth');
    logger.info('[UsersService] Initialisé');
  }

  /**
   * Crée ou met à jour un utilisateur à partir du profil GitLab
   * @param {object} profile — { id, emails:[{value}], displayName, username, photos:[{value}] }
   * @returns {object} user
   */
  upsertFromGitLab(profile: any) {
    const gitlabId = parseInt(profile.id);
    const email = profile.emails?.[0]?.value || `${profile.username}@gitlab.local`;
    const name = profile.displayName || profile.username || 'Utilisateur GitLab';
    const avatar = profile.photos?.[0]?.value || null;

    // Premier utilisateur = admin automatique
    const count = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const role = count === 0 ? 'admin' : 'viewer';

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO users (gitlab_id, email, name, avatar, role, last_login)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    insert.run(gitlabId, email, name, avatar, role);

    const update = this.db.prepare(`
      UPDATE users SET
        email = ?,
        name = ?,
        avatar = ?,
        last_login = datetime('now')
      WHERE gitlab_id = ?
    `);
    update.run(email, name, avatar, gitlabId);

    const user = this.db.prepare('SELECT * FROM users WHERE gitlab_id = ?').get(gitlabId);
    return user;
  }

  findById(id: any) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  findByGitLabId(gitlabId: any) {
    return this.db.prepare('SELECT * FROM users WHERE gitlab_id = ?').get(gitlabId);
  }

  findAll() {
    return this.db
      .prepare('SELECT id, gitlab_id, email, name, avatar, role, created_at, last_login FROM users ORDER BY name')
      .all();
  }

  updateRole(userId: any, role: any) {
    const stmt = this.db.prepare('UPDATE users SET role = ? WHERE id = ?');
    const result = stmt.run(role, userId);
    return result.changes > 0;
  }
}

export default new UsersService();
