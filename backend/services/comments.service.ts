import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.service';
import { run } from '../db/migrate';

class CommentsService {
  db: any;
  projectId: number;

  constructor() {
    this.db = null;
    this.projectId = parseInt(process.env.CROSSTEST_PROJECT_ID || '') || 63;
  }

  /**
   * Initialise la base de données SQLite et crée la table si besoin
   */
  init() {
    try {
      const dbPath = path.join(process.env.DB_DATA_DIR || path.join(__dirname, '../db'), 'crosstest-comments.db');
      this.db = new Database(dbPath);

      run(this.db, 'comments');

      logger.info('CommentsService: SQLite initialisé (crosstest-comments.db)');
    } catch (error) {
      logger.error('CommentsService: Erreur initialisation SQLite:', error);
      throw error;
    }
  }

  /**
   * Retourne tous les commentaires sous forme d'objet indexé par issue_iid
   * @returns {Object} { [iid]: { id, issue_iid, comment, milestone_context, created_at, updated_at } }
   */
  getAll() {
    try {
      const rows = this.db
        .prepare('SELECT * FROM crosstest_comments WHERE gitlab_project_id = ? ORDER BY updated_at DESC')
        .all(this.projectId);

      const result: any = {};
      for (const row of rows) {
        result[row.issue_iid] = row;
      }
      return result;
    } catch (error) {
      logger.error('CommentsService: Erreur getAll:', error);
      throw error;
    }
  }

  /**
   * Insère ou met à jour un commentaire (upsert)
   * @param {number} iid               - GitLab issue IID
   * @param {string} comment           - Texte du commentaire
   * @param {string} milestoneContext  - ex: "R06"
   * @returns {Object} La ligne insérée/mise à jour
   */
  upsert(iid: any, comment: any, milestoneContext = null) {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO crosstest_comments (issue_iid, gitlab_project_id, milestone_context, comment, created_at, updated_at)
        VALUES (@iid, @projectId, @milestoneContext, @comment, @now, @now)
        ON CONFLICT(issue_iid, gitlab_project_id) DO UPDATE SET
          comment           = excluded.comment,
          milestone_context = excluded.milestone_context,
          updated_at        = excluded.updated_at
      `);
      stmt.run({ iid, projectId: this.projectId, milestoneContext, comment, now });

      const row = this.db
        .prepare('SELECT * FROM crosstest_comments WHERE issue_iid = ? AND gitlab_project_id = ?')
        .get(iid, this.projectId);
      return row;
    } catch (error) {
      logger.error(`CommentsService: Erreur upsert iid=${iid}:`, error);
      throw error;
    }
  }

  /**
   * Supprime le commentaire d'une issue
   * @param {number} iid - GitLab issue IID
   * @returns {boolean} true si une ligne a été supprimée
   */
  delete(iid: any) {
    try {
      const result = this.db
        .prepare('DELETE FROM crosstest_comments WHERE issue_iid = ? AND gitlab_project_id = ?')
        .run(iid, this.projectId);
      return result.changes > 0;
    } catch (error) {
      logger.error(`CommentsService: Erreur delete iid=${iid}:`, error);
      throw error;
    }
  }
}

export default new CommentsService();
