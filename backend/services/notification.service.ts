import emailService from './email.service';
import alertService from './alert.service';
import logger from './logger.service';
import Database from 'better-sqlite3';
import path from 'path';
import { run as runMigrations } from '../db/migrate';
import templateService from './template.service';
import webhooksService from './webhooks.service';

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');
const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

class NotificationService {
  db: any;

  constructor() {
    this.db = null;
    this._init();
  }

  _init() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db, 'sync-history');
  }

  /**
   * Dispatch une alerte SLA vers tous les canaux configurés
   */
  async dispatch(projectId: any, alerts: any, projectName: string | null = null) {
    if (!alerts || alerts.length === 0) return;

    const settings = this.getSettings(projectId);
    const defaultSettings = this.getSettings(null); // global fallback
    const merged = this._mergeSettings(settings, defaultSettings);

    if (!merged) {
      // Fallback sur l'alert.service legacy (webhooks env vars)
      return alertService.sendSLAAlert(projectId, alerts);
    }

    // Rate-limiting par projet
    if (this._isRateLimited(projectId)) {
      logger.info(`[NotificationService] Rate-limit actif pour projet ${projectId} — alerte ignorée`);
      return;
    }

    const promises = [];

    // Préparer les variables pour chaque alerte
    const varsList = alerts.map((alert: any) => ({
      metric: alert.metric,
      value: String(alert.value),
      threshold: String(alert.threshold),
      severity: alert.severity,
      projectName: projectName || `Projet ${projectId}`,
      timestamp: new Date().toISOString(),
    }));

    if (merged.enabled_sla_email && merged.email) {
      const customHtml = merged.email_template
        ? varsList.map((v: any) => templateService.render('email', merged.email_template, v, '')).join('<hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;"/>')
        : undefined;
      const customText = merged.email_template
        ? varsList.map((v: any) => templateService.render('email', merged.email_template, v, '')).join('\n---\n')
        : undefined;
      promises.push(
        emailService
          .sendSLAAlert({
            to: merged.email,
            projectId,
            projectName: projectName || null,
            alerts,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?project=${projectId}`,
            customHtml,
            customText,
          })
          .then((r: any) => {
            if (r.sent) this._logAlert(projectId, 'email');
          })
      );
    }

    if (merged.enabled_sla_slack && merged.slack_webhook) {
      const text = merged.slack_template
        ? varsList.map((v: any) => templateService.render('slack', merged.slack_template, v, '')).join('\n\n')
        : alertService._formatSlackMessage(projectId, alerts);
      promises.push(
        alertService
          ._sendSlack(text, merged.slack_webhook)
          .then(() => this._logAlert(projectId, 'slack'))
      );
    }

    if (merged.enabled_sla_teams && merged.teams_webhook) {
      if (merged.teams_template) {
        const card = alertService._formatTeamsCard(projectId, alerts);
        const rendered = templateService.render('teams', merged.teams_template, varsList[0], '');
        card.summary = rendered;
        if (card.sections && card.sections[0]) {
          card.sections[0].activityTitle = rendered;
        }
        promises.push(
          alertService
            ._sendTeams(card, merged.teams_webhook)
            .then(() => this._logAlert(projectId, 'teams'))
        );
      } else {
        promises.push(
          alertService
            ._sendTeams(alertService._formatTeamsCard(projectId, alerts), merged.teams_webhook)
            .then(() => this._logAlert(projectId, 'teams'))
        );
      }
    }

    // Émettre les webhooks métriques pour chaque alerte
    for (const alert of alerts) {
      promises.push(
        webhooksService.emitMetricAlert(
          alert.metric,
          alert.severity,
          alert.value,
          alert.threshold,
          projectId,
          projectName || `Projet ${projectId}`
        )
      );
    }

    // Si aucun canal configuré en DB, fallback legacy
    if (promises.length === 0) {
      return alertService.sendSLAAlert(projectId, alerts);
    }

    await Promise.all(promises);
  }

  getSettings(projectId: any) {
    if (projectId === null || projectId === undefined) {
      const stmt = this.db.prepare('SELECT * FROM notification_settings WHERE project_id IS NULL');
      return stmt.get() || null;
    }
    const stmt = this.db.prepare('SELECT * FROM notification_settings WHERE project_id = ?');
    return stmt.get(projectId) || null;
  }

  upsertSettings({ projectId, email, slackWebhook, teamsWebhook, enabledSlaEmail, enabledSlaSlack, enabledSlaTeams, emailTemplate, slackTemplate, teamsTemplate }: any) {
    const existing = this.getSettings(projectId || null);
    if (existing) {
      this.db
        .prepare(
          `
        UPDATE notification_settings SET
          email = ?,
          slack_webhook = ?,
          teams_webhook = ?,
          enabled_sla_email = ?,
          enabled_sla_slack = ?,
          enabled_sla_teams = ?,
          email_template = ?,
          slack_template = ?,
          teams_template = ?,
          updated_at = datetime('now')
        WHERE project_id = ?
      `
        )
        .run(
          email || null,
          slackWebhook || null,
          teamsWebhook || null,
          enabledSlaEmail ? 1 : 0,
          enabledSlaSlack ? 1 : 0,
          enabledSlaTeams ? 1 : 0,
          emailTemplate || null,
          slackTemplate || null,
          teamsTemplate || null,
          projectId || null
        );
    } else {
      this.db
        .prepare(
          `
        INSERT INTO notification_settings (project_id, email, slack_webhook, teams_webhook, enabled_sla_email, enabled_sla_slack, enabled_sla_teams, email_template, slack_template, teams_template, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `
        )
        .run(
          projectId || null,
          email || null,
          slackWebhook || null,
          teamsWebhook || null,
          enabledSlaEmail ? 1 : 0,
          enabledSlaSlack ? 1 : 0,
          enabledSlaTeams ? 1 : 0,
          emailTemplate || null,
          slackTemplate || null,
          teamsTemplate || null
        );
    }
    return this.getSettings(projectId || null);
  }

  async testWebhook(channel: any, url: any, template?: string) {
    if (channel === 'slack') {
      const text = template || '✅ Test de connexion — QA Dashboard Slack';
      await alertService._sendSlack(text, url);
      return { ok: true };
    }
    if (channel === 'teams') {
      const card = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: '10B981',
        summary: template || 'Test QA Dashboard',
        sections: [{ activityTitle: template || '✅ Test de connexion — QA Dashboard Teams' }],
      };
      await alertService._sendTeams(card, url);
      return { ok: true };
    }
    return { ok: false, error: 'Canal inconnu' };
  }

  _mergeSettings(specific: any, fallback: any) {
    if (specific) return specific;
    if (fallback) return fallback;
    return null;
  }

  _isRateLimited(projectId: any) {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM alert_log WHERE project_id = ? AND sent_at > datetime('now', '-15 minutes')"
      )
      .get(projectId);
    return (row?.count || 0) > 0;
  }

  _logAlert(projectId: any, channel: any) {
    this.db.prepare('INSERT INTO alert_log (project_id, channel) VALUES (?, ?)').run(projectId, channel);
  }
}

export default new NotificationService();
