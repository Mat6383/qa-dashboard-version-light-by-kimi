import notificationService from '../services/notification.service';
import emailService from '../services/email.service';
import alertService from '../services/alert.service';
import templateService from '../services/template.service';
import webhooksService from '../services/webhooks.service';
/**
 * Tests du service de notification
 */

jest.mock('better-sqlite3', () => {
  const actual = jest.requireActual('better-sqlite3');
  return jest.fn(() => new actual(':memory:'));
});

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/email.service', () => ({
  sendSLAAlert: jest.fn().mockResolvedValue({ sent: true, messageId: 'test-123' }),
}));

jest.mock('../services/alert.service', () => ({
  _sendSlack: jest.fn().mockResolvedValue(undefined),
  _sendTeams: jest.fn().mockResolvedValue(undefined),
  _formatSlackMessage: jest.fn((projectId, alerts) => `Slack: ${projectId}`),
  _formatTeamsCard: jest.fn((projectId, alerts) => ({
    summary: `Teams: ${projectId}`,
    sections: [{ activityTitle: `Teams: ${projectId}` }],
  })),
  sendSLAAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/template.service', () => ({
  render: jest.fn((channel, template, vars, fallback) => template || fallback),
}));

jest.mock('../services/webhooks.service', () => ({
  emitMetricAlert: jest.fn().mockResolvedValue(undefined),
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('dispatches email and webhook when configured', async () => {
    notificationService._init();
    notificationService.upsertSettings({
      projectId: 1,
      email: 'alert@test.com',
      slackWebhook: 'https://hooks.slack.com/test',
      teamsWebhook: 'https://teams.webhook/test',
      enabledSlaEmail: true,
      enabledSlaSlack: true,
      enabledSlaTeams: true,
    });


    await notificationService.dispatch(1, [{ severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85 }]);

    expect(emailService.sendSLAAlert).toHaveBeenCalled();
    expect(alertService._sendSlack).toHaveBeenCalled();
    expect(alertService._sendTeams).toHaveBeenCalled();
  });

  it('falls back to legacy alertService when no DB settings', async () => {
    notificationService._init();

    await notificationService.dispatch(1, [{ severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85 }]);

    expect(alertService.sendSLAAlert).toHaveBeenCalled();
  });

  it('rate-limits alerts per project', async () => {
    notificationService._init();
    notificationService.upsertSettings({
      projectId: 2,
      email: 'test@test.com',
      enabledSlaEmail: true,
    });


    await notificationService.dispatch(2, [{ severity: 'critical', metric: 'X', value: 1, threshold: 2 }]);
    await notificationService.dispatch(2, [{ severity: 'critical', metric: 'Y', value: 1, threshold: 2 }]);

    // Rate-limit actif après le premier envoi
    expect(emailService.sendSLAAlert).toHaveBeenCalledTimes(1);
  });

  it('tests webhook connection', async () => {
    notificationService._init();

    const result = await notificationService.testWebhook('slack', 'https://hooks.slack.com/test');
    expect(result.ok).toBe(true);
    expect(alertService._sendSlack).toHaveBeenCalledWith(
      expect.stringContaining('Test'),
      'https://hooks.slack.com/test'
    );
  });

  it('returns error for unknown webhook channel', async () => {
    notificationService._init();
    const result = await notificationService.testWebhook('discord', 'https://discord.com/test');
    expect(result.ok).toBe(false);
  });

  it('utilise le template personnalisé slack si présent', async () => {
    notificationService._init();
    notificationService.upsertSettings({
      projectId: 1,
      slackWebhook: 'https://hooks.slack.com/test',
      enabledSlaSlack: true,
      slackTemplate: 'Custom {{metric}}: {{value}}',
    });

    await notificationService.dispatch(1, [{ severity: 'critical', metric: 'passRate', value: 80, threshold: 85 }]);

    expect(templateService.render).toHaveBeenCalledWith(
      'slack',
      'Custom {{metric}}: {{value}}',
      expect.objectContaining({ metric: 'passRate', value: '80' }),
      expect.any(String)
    );
  });

  it('émet les webhooks métriques pour chaque alerte', async () => {
    notificationService._init();
    notificationService.upsertSettings({
      projectId: 1,
      email: 'test@test.com',
      enabledSlaEmail: true,
    });

    await notificationService.dispatch(1, [
      { severity: 'warning', metric: 'passRate', value: 85, threshold: 90 },
      { severity: 'critical', metric: 'blockedRate', value: 10, threshold: 5 },
    ]);

    expect(webhooksService.emitMetricAlert).toHaveBeenCalledTimes(2);
    expect(webhooksService.emitMetricAlert).toHaveBeenCalledWith('passRate', 'warning', 85, 90, 1, expect.any(String));
    expect(webhooksService.emitMetricAlert).toHaveBeenCalledWith('blockedRate', 'critical', 10, 5, 1, expect.any(String));
  });
});
