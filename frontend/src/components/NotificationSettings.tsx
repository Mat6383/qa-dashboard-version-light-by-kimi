/**
 * ================================================
 * NOTIFICATION SETTINGS — Configuration alertes
 * ================================================
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';
import { trpc } from '../trpc/client';
import { useSaveNotificationSettings, useTestNotificationWebhook } from '../hooks/mutations/useNotifications';
import { useSaveAlertTemplates } from '../hooks/mutations/useAlertTemplates';
import { useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from '../hooks/mutations/useWebhooks';
import { Bell, Settings, FileText, Webhook } from 'lucide-react';
import NotificationChannels from './NotificationChannels';
import AlertTemplates from './AlertTemplates';
import WebhookSubscriptions from './WebhookSubscriptions';

const TAB_CHANNELS = 'channels';
const TAB_TEMPLATES = 'templates';
const TAB_WEBHOOKS = 'webhooks';

export default function NotificationSettings({ isDark }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(TAB_CHANNELS);

  const { data: settingsData, isLoading: loadingSettings } = trpc.notifications.settings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: webhooksData, isLoading: loadingWebhooks } = useWebhooks();

  const [settings, setSettings] = useState({
    email: '',
    slackWebhook: '',
    teamsWebhook: '',
    enabledSlaEmail: false,
    enabledSlaSlack: false,
    enabledSlaTeams: false,
    emailTemplate: '',
    slackTemplate: '',
    teamsTemplate: '',
  });

  useEffect(() => {
    if (settingsData?.data) {
      const data = settingsData.data;
      setSettings({
        email: data.email || '',
        slackWebhook: data.slack_webhook || '',
        teamsWebhook: data.teams_webhook || '',
        enabledSlaEmail: !!data.enabled_sla_email,
        enabledSlaSlack: !!data.enabled_sla_slack,
        enabledSlaTeams: !!data.enabled_sla_teams,
        emailTemplate: data.email_template || '',
        slackTemplate: data.slack_template || '',
        teamsTemplate: data.teams_template || '',
      });
    }
  }, [settingsData]);

  const saveMutation = useSaveNotificationSettings();
  const saveTemplatesMutation = useSaveAlertTemplates();
  const testMutation = useTestNotificationWebhook();
  const createWebhookMutation = useCreateWebhook();
  const updateWebhookMutation = useUpdateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();

  const handleSaveChannels = async () => {
    try {
      await saveMutation.mutateAsync({
        email: settings.email,
        slackWebhook: settings.slackWebhook,
        teamsWebhook: settings.teamsWebhook,
        enabledSlaEmail: settings.enabledSlaEmail,
        enabledSlaSlack: settings.enabledSlaSlack,
        enabledSlaTeams: settings.enabledSlaTeams,
      });
      showToast(t('notifications.settingsSaved'), 'success');
    } catch (err) {
      showToast(t('notifications.saveError'), 'error');
    }
  };

  const handleSaveTemplates = async (templates) => {
    try {
      await saveTemplatesMutation.mutateAsync({
        emailTemplate: templates.emailTemplate || null,
        slackTemplate: templates.slackTemplate || null,
        teamsTemplate: templates.teamsTemplate || null,
      });
      showToast(t('notifications.templatesSaved') || 'Templates sauvegardés', 'success');
    } catch (err) {
      showToast(t('notifications.saveError'), 'error');
    }
  };

  const handleTest = async (channel) => {
    const url = channel === 'slack' ? settings.slackWebhook : settings.teamsWebhook;
    if (!url) {
      showToast(t('notifications.webhookNotConfigured', { channel }), 'error');
      return;
    }
    try {
      await testMutation.mutateAsync({ channel, url });
      showToast(t('notifications.testSent', { channel }), 'success');
    } catch (err) {
      showToast(t('notifications.testFailed', { channel }), 'error');
    }
  };

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid var(--text-primary)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    fontWeight: activeTab === tab ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    fontSize: '0.875rem',
  });

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Bell size={24} />
        {t('notifications.title')}
      </h2>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button style={tabStyle(TAB_CHANNELS)} onClick={() => setActiveTab(TAB_CHANNELS)} type="button">
          <Settings size={16} /> {t('notifications.tabs.channels') || 'Paramètres'}
        </button>
        <button style={tabStyle(TAB_TEMPLATES)} onClick={() => setActiveTab(TAB_TEMPLATES)} type="button">
          <FileText size={16} /> {t('notifications.tabs.templates') || 'Templates'}
        </button>
        <button style={tabStyle(TAB_WEBHOOKS)} onClick={() => setActiveTab(TAB_WEBHOOKS)} type="button">
          <Webhook size={16} /> {t('notifications.tabs.webhooks') || 'Webhooks'}
        </button>
      </div>

      {loadingSettings || loadingWebhooks ? (
        <p>{t('common.loading')}</p>
      ) : (
        <>
          {activeTab === TAB_CHANNELS && (
            <NotificationChannels
              isDark={isDark}
              settings={settings}
              setSettings={setSettings}
              onSave={handleSaveChannels}
              savePending={saveMutation.isPending}
              onTest={handleTest}
            />
          )}
          {activeTab === TAB_TEMPLATES && (
            <AlertTemplates
              isDark={isDark}
              templates={{
                emailTemplate: settings.emailTemplate,
                slackTemplate: settings.slackTemplate,
                teamsTemplate: settings.teamsTemplate,
              }}
              onSave={handleSaveTemplates}
              savePending={saveTemplatesMutation.isPending}
            />
          )}
          {activeTab === TAB_WEBHOOKS && (
            <WebhookSubscriptions
              isDark={isDark}
              subscriptions={webhooksData?.data || []}
              onCreate={(data) => createWebhookMutation.mutateAsync(data)}
              onUpdate={(id, data) => updateWebhookMutation.mutateAsync({ id, ...data })}
              onDelete={(id) => deleteWebhookMutation.mutateAsync({ id })}
            />
          )}
        </>
      )}
    </div>
  );
}
