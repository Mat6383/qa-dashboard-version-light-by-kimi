import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.service';
import { run as runMigrations } from '../db/migrate';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

interface IntegrationInput {
  name: string;
  type: 'jira' | 'azure_devops' | 'generic_webhook' | 'gitlab';
  config: Record<string, unknown>;
  enabled?: boolean;
}

export interface Integration extends IntegrationInput {
  id: number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

class IntegrationService {
  db: any;

  constructor() {
    this.db = null;
  }

  init() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    runMigrations(this.db, 'integrations');
    logger.info('[IntegrationService] Initialisé');
  }

  ensureDb() {
    if (!this.db) this.init();
  }

  list(): Integration[] {
    this.ensureDb();
    const stmt = this.db.prepare('SELECT * FROM integrations ORDER BY created_at DESC');
    const rows = stmt.all();
    return rows.map((r: any) => ({
      ...r,
      config: r.config_json ? JSON.parse(r.config_json) : {},
      enabled: !!r.enabled,
    }));
  }

  getById(id: number): Integration | null {
    this.ensureDb();
    const row = this.db.prepare('SELECT * FROM integrations WHERE id = ?').get(id);
    if (!row) return null;
    return {
      ...row,
      config: row.config_json ? JSON.parse(row.config_json) : {},
      enabled: !!row.enabled,
    };
  }

  create(input: IntegrationInput): Integration {
    this.ensureDb();
    const stmt = this.db.prepare(`
      INSERT INTO integrations (name, type, config_json, enabled)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(input.name, input.type, JSON.stringify(input.config), input.enabled ?? true ? 1 : 0);
    return this.getById(result.lastInsertRowid) as Integration;
  }

  update(id: number, input: Partial<IntegrationInput>): Integration | null {
    this.ensureDb();
    const sets: string[] = [];
    const params: any[] = [];
    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
    if (input.type !== undefined) { sets.push('type = ?'); params.push(input.type); }
    if (input.config !== undefined) { sets.push('config_json = ?'); params.push(JSON.stringify(input.config)); }
    if (input.enabled !== undefined) { sets.push('enabled = ?'); params.push(input.enabled ? 1 : 0); }
    if (sets.length === 0) return this.getById(id);
    sets.push("updated_at = datetime('now')");
    params.push(id);
    this.db.prepare(`UPDATE integrations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  delete(id: number) {
    this.ensureDb();
    this.db.prepare('DELETE FROM integrations WHERE id = ?').run(id);
  }

  updateLastSync(id: number) {
    this.ensureDb();
    this.db.prepare("UPDATE integrations SET last_sync_at = datetime('now') WHERE id = ?").run(id);
  }

  /**
   * Teste la connectivité d'une intégration Jira
   */
  async testJiraConnection(config: any): Promise<{ success: boolean; message: string }> {
    try {
      const { baseUrl, username, apiToken } = config;
      if (!baseUrl || !apiToken) {
        return { success: false, message: 'URL de base et token API requis' };
      }
      const auth = Buffer.from(`${username || ''}:${apiToken}`).toString('base64');
      const res = await fetch(`${baseUrl}/rest/api/2/myself`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return { success: true, message: 'Connexion Jira réussie' };
      }
      return { success: false, message: `Jira HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Crée un ticket Jira à partir d'un échec de test
   */
  async createJiraIssue(config: any, issue: { summary: string; description: string; issueType?: string }): Promise<{ success: boolean; key?: string; message: string }> {
    try {
      const { baseUrl, username, apiToken, projectKey } = config;
      if (!baseUrl || !apiToken || !projectKey) {
        return { success: false, message: 'baseUrl, token et projectKey requis' };
      }
      const auth = Buffer.from(`${username || ''}:${apiToken}`).toString('base64');
      const res = await fetch(`${baseUrl}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: issue.summary,
            description: issue.description,
            issuetype: { name: issue.issueType || 'Bug' },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json() as { key: string };
        return { success: true, key: data.key, message: `Ticket créé: ${data.key}` };
      }
      const err = await res.text();
      return { success: false, message: `Jira HTTP ${res.status}: ${err}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Teste la connectivité d'une intégration GitLab
   */
  async testGitLabConnection(config: any): Promise<{ success: boolean; message: string }> {
    const { default: gitlabConnectorService } = await import('./gitlabConnector.service');
    return gitlabConnectorService.testConnection({
      baseUrl: config.baseUrl,
      token: config.token,
      projectId: config.projectId,
      verifySsl: config.verifySsl,
    });
  }

  /**
   * Émet un webhook générique
   */
  async sendWebhook(config: any, payload: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    try {
      const { url, secret } = config;
      if (!url) return { success: false, message: 'URL webhook requise' };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret) {
        const crypto = await import('crypto');
        const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${sig}`;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        return { success: true, message: `Webhook envoyé (${res.status})` };
      }
      return { success: false, message: `Webhook HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

export default new IntegrationService();
