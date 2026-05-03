import { describe, it, expect, jest } from '@jest/globals';
import { createAdminCaller, createAuthedCaller, createTestCaller } from './setup';

jest.mock('../../services/notification.service', () => ({
  __esModule: true,
  default: {
    getSettings: jest.fn(),
    upsertSettings: jest.fn(),
    testWebhook: jest.fn(),
  },
}));

describe('tRPC notifications router', () => {
  it('returns settings for authed user', async () => {
    const service = require('../../services/notification.service').default;
    service.getSettings.mockReturnValue({ email: 'a@b.com' });

    const caller = createAuthedCaller();
    const result = await caller.notifications.settings({ projectId: null });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('a@b.com');
  });

  it('rejects unauthenticated user', async () => {
    const caller = createTestCaller();
    await expect(caller.notifications.settings({})).rejects.toThrow('Authentification requise');
  });

  it('saves settings via admin procedure', async () => {
    const service = require('../../services/notification.service').default;
    service.upsertSettings.mockReturnValue({ email: 'new@b.com' });

    const caller = createAdminCaller();
    const result = await caller.notifications.saveSettings({ email: 'new@b.com' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('new@b.com');
  });

  it('tests webhook successfully', async () => {
    const service = require('../../services/notification.service').default;
    service.testWebhook.mockResolvedValue({ ok: true });

    const caller = createAdminCaller();
    const result = await caller.notifications.testWebhook({ channel: 'slack', url: 'https://hooks.slack.com/test' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('slack');
  });

  it('throws on failed webhook test', async () => {
    const service = require('../../services/notification.service').default;
    service.testWebhook.mockResolvedValue({ ok: false, error: 'Invalid URL' });

    const caller = createAdminCaller();
    const service2 = require('../../services/notification.service').default;
    service2.testWebhook.mockResolvedValue({ ok: false, error: 'Invalid URL' });

    const caller2 = createAdminCaller();
    await expect(caller2.notifications.testWebhook({ channel: 'slack', url: 'https://hooks.slack.com/bad' })).rejects.toThrow('Invalid URL');
  });
});
