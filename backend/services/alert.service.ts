import axios from 'axios';
import logger from './logger.service';

class AlertService {
  slackWebhookUrl: any;
  teamsWebhookUrl: any;

  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    this.teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL || null;
  }

  /**
   * Envoie une alerte SLA aux webhooks configurés
   * @param {number} projectId
   * @param {Array} alerts - Liste des alertes SLA
   */
  async sendSLAAlert(projectId: any, alerts: any) {
    if (!alerts || alerts.length === 0) return;

    const text = this._formatSlackMessage(projectId, alerts);
    const teamsCard = this._formatTeamsCard(projectId, alerts);

    await Promise.all([this._sendSlack(text), this._sendTeams(teamsCard)]);
  }

  _formatSlackMessage(projectId: any, alerts: any) {
    const lines = alerts.map(
      (a: any) => `• *[${a.severity.toUpperCase()}]* ${a.metric}: ${a.value}% (seuil: ${a.threshold}%)`
    );
    return `🚨 *Alertes SLA — Projet ${projectId}*\n${lines.join('\n')}`;
  }

  _formatTeamsCard(projectId: any, alerts: any) {
    const facts = alerts.map((a: any) => ({
      name: `${a.severity.toUpperCase()} — ${a.metric}`,
      value: `${a.value}% (seuil: ${a.threshold}%)`,
    }));

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: 'EF4444',
      summary: `Alertes SLA — Projet ${projectId}`,
      sections: [
        {
          activityTitle: `🚨 Alertes SLA — Projet ${projectId}`,
          facts,
        },
      ],
    };
  }

  async _sendSlack(text: any, customUrl?: any) {
    const url = customUrl || this.slackWebhookUrl;
    if (!url) return;
    try {
      await axios.post(url, { text }, { timeout: 5000 });
      logger.info('[AlertService] Slack alert sent');
    } catch (err: any) {
      logger.warn('[AlertService] Slack webhook failed:', err.message);
    }
  }

  async _sendTeams(card: any, customUrl?: any) {
    const url = customUrl || this.teamsWebhookUrl;
    if (!url) return;
    try {
      await axios.post(url, card, { timeout: 5000 });
      logger.info('[AlertService] Teams alert sent');
    } catch (err: any) {
      logger.warn('[AlertService] Teams webhook failed:', err.message);
    }
  }
}

export default new AlertService();
