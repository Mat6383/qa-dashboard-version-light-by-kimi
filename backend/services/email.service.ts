import nodemailer from 'nodemailer';
import i18n from '../i18n';
import logger from './logger.service';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '') || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'qa-dashboard@neo-logix.local';

class EmailService {
  transporter: any;

  constructor() {
    this.transporter = null;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    } else {
      logger.warn('[EmailService] Configuration SMTP incomplète — emails désactivés');
    }
  }

  async sendSLAAlert({ to, projectId, projectName, alerts, dashboardUrl, lang = 'fr', customHtml, customText }: any) {
    if (!this.transporter || !to) return { sent: false, reason: 'not_configured' };

    const subject = i18n.t('email.slaAlertSubject', { lng: lang, interpolation: { escapeValue: false } }).replace('{{projectName}}', projectName || `Projet ${projectId}`);
    const html = customHtml || this._buildHTML({ projectId, projectName, alerts, dashboardUrl, lang });

    try {
      const info = await this.transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
        text: customText || this._buildText({ projectId, projectName, alerts, dashboardUrl, lang }),
      });
      logger.info('[EmailService] Email envoyé:', info.messageId);
      return { sent: true, messageId: info.messageId };
    } catch (err: any) {
      logger.error('[EmailService] Échec envoi email:', err.message);
      return { sent: false, reason: err.message };
    }
  }

  _buildHTML({ projectId, projectName, alerts, dashboardUrl, lang }: any) {
    const t = (key: string) => i18n.t(`email.${key}`, { lng: lang, interpolation: { escapeValue: false } });
    const rows = alerts
      .map(
        (a: any) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px;"><strong style="color:${a.severity === 'critical' ? '#DC2626' : '#F59E0B'}">${a.severity.toUpperCase()}</strong></td>
        <td style="padding:8px;">${a.metric}</td>
        <td style="padding:8px;">${a.value}%</td>
        <td style="padding:8px;">${t('threshold')}: ${a.threshold}%</td>
      </tr>`
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SLA Alert</title></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;padding:24px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
    <div style="background:#DC2626;color:#fff;padding:16px 24px;">
      <h2 style="margin:0;font-size:1.25rem;">${t('slaAlertTitle')}</h2>
      <p style="margin:4px 0 0;">${projectName || `Projet ${projectId}`}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
      <thead style="background:#f9fafb;">
        <tr><th style="padding:8px;text-align:left;">${t('severity')}</th><th style="padding:8px;text-align:left;">${t('metric')}</th><th style="padding:8px;text-align:left;">${t('value')}</th><th style="padding:8px;text-align:left;">${t('threshold')}</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:16px 24px;text-align:center;">
      <a href="${dashboardUrl || '#'}" style="display:inline-block;background:#3B82F6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">${t('viewDashboard')}</a>
    </div>
  </div>
</body>
</html>`;
  }

  _buildText({ projectId, projectName, alerts, dashboardUrl, lang }: any) {
    const t = (key: string) => i18n.t(`email.${key}`, { lng: lang, interpolation: { escapeValue: false } });
    const lines = alerts.map(
      (a: any) => `- [${a.severity.toUpperCase()}] ${a.metric}: ${a.value}% (${t('threshold')}: ${a.threshold}%)`
    );
    return `${t('slaAlertText').replace('{{projectName}}', projectName || `Projet ${projectId}`)}\n\n${lines.join('\n')}\n\n${dashboardUrl || ''}`;
  }
}

export default new EmailService();
