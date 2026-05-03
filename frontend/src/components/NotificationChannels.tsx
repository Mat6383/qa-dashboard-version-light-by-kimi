import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MessageSquare, Send, Save, TestTube } from 'lucide-react';

export default function NotificationChannels({ isDark, settings, setSettings, onSave, savePending, onTest }) {
  const { t } = useTranslation();

  const cardStyle = {
    backgroundColor: 'var(--surface-muted)',
    border: `1px solid ${'var(--border-color)'}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '6px',
    color: 'var(--text-color)',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${'var(--border-color)'}`,
    backgroundColor: 'var(--surface-default)',
    color: 'var(--text-color)',
    fontSize: '0.875rem',
  };

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
          <Mail size={18} />
          {t('notifications.emailSla')}
        </h3>
        <label style={labelStyle}>{t('notifications.emailAddress')}</label>
        <input
          type="email"
          style={inputStyle}
          value={settings.email}
          onChange={(e) => setSettings({ ...settings, email: e.target.value })}
          placeholder="alerts@neo-logix.local"
        />
        <label style={{ ...labelStyle, marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.enabledSlaEmail}
            onChange={(e) => setSettings({ ...settings, enabledSlaEmail: e.target.checked })}
          />
          {t('notifications.enableEmailAlerts')}
        </label>
      </div>

      <div style={cardStyle}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
          <MessageSquare size={18} />
          Slack
        </h3>
        <label style={labelStyle}>{t('notifications.webhookUrl')}</label>
        <input
          type="url"
          style={inputStyle}
          value={settings.slackWebhook}
          onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
          placeholder="https://hooks.slack.com/services/..."
        />
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ ...labelStyle, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={settings.enabledSlaSlack}
              onChange={(e) => setSettings({ ...settings, enabledSlaSlack: e.target.checked })}
            />
            {t('notifications.enableSlackAlerts')}
          </label>
          <button className="btn-toggle" onClick={() => onTest('slack')} type="button">
            <TestTube size={14} />
            {t('common.test')}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
          <Send size={18} />
          Microsoft Teams
        </h3>
        <label style={labelStyle}>{t('notifications.webhookUrl')}</label>
        <input
          type="url"
          style={inputStyle}
          value={settings.teamsWebhook}
          onChange={(e) => setSettings({ ...settings, teamsWebhook: e.target.value })}
          placeholder="https://neo-logix.webhook.office.com/webhookb2/..."
        />
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ ...labelStyle, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={settings.enabledSlaTeams}
              onChange={(e) => setSettings({ ...settings, enabledSlaTeams: e.target.checked })}
            />
            {t('notifications.enableTeamsAlerts')}
          </label>
          <button className="btn-toggle" onClick={() => onTest('teams')} type="button">
            <TestTube size={14} />
            {t('common.test')}
          </button>
        </div>
      </div>

      <button
        className="btn-toggle"
        onClick={onSave}
        disabled={savePending}
        type="button"
        style={{ backgroundColor: 'var(--text-success)', color: '#fff', border: 'none' }}
      >
        <Save size={16} />
        {savePending ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
}
