import axios from 'axios';
import alertService from '../services/alert.service';

jest.mock('axios');
jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('AlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.TEAMS_WEBHOOK_URL;
    // Re-instantiate with fresh env (module is cached, but constructor reads env at require time)
    // We mutate the singleton's properties directly for testing
    alertService.slackWebhookUrl = null;
    alertService.teamsWebhookUrl = null;
  });

  it('does nothing when no alerts are provided', async () => {
    await alertService.sendSLAAlert(1, []);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does nothing when no webhooks are configured', async () => {
    await alertService.sendSLAAlert(1, [
      { severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85, message: 'Pass rate critique' },
    ]);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('sends Slack alert when SLACK_WEBHOOK_URL is set', async () => {
    alertService.slackWebhookUrl = 'https://hooks.slack.com/test';
    axios.post.mockResolvedValue({ status: 200 });

    await alertService.sendSLAAlert(1, [
      { severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85, message: 'Pass rate critique' },
    ]);

    expect(axios.post).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      { text: expect.stringContaining('Pass Rate') },
      { timeout: 5000 }
    );
  });

  it('sends Teams alert when TEAMS_WEBHOOK_URL is set', async () => {
    alertService.teamsWebhookUrl = 'https://outlook.office.com/webhook/test';
    axios.post.mockResolvedValue({ status: 200 });

    await alertService.sendSLAAlert(1, [
      { severity: 'warning', metric: 'Blocked Rate', value: 8, threshold: 5, message: 'Trop bloqués' },
    ]);

    expect(axios.post).toHaveBeenCalledWith(
      'https://outlook.office.com/webhook/test',
      expect.objectContaining({
        '@type': 'MessageCard',
        summary: expect.stringContaining('Alertes SLA'),
      }),
      { timeout: 5000 }
    );
  });

  it('sends both alerts when both webhooks are configured', async () => {
    alertService.slackWebhookUrl = 'https://hooks.slack.com/test';
    alertService.teamsWebhookUrl = 'https://outlook.office.com/webhook/test';
    axios.post.mockResolvedValue({ status: 200 });

    await alertService.sendSLAAlert(1, [
      { severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85, message: 'Pass rate critique' },
    ]);

    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('swallows webhook errors gracefully', async () => {
    alertService.slackWebhookUrl = 'https://hooks.slack.com/test';
    axios.post.mockRejectedValue(new Error('Network error'));

    await expect(
      alertService.sendSLAAlert(1, [
        { severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85, message: 'Pass rate critique' },
      ])
    ).resolves.toBeUndefined();
  });
});
