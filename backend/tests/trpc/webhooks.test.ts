import { describe, it, expect, jest } from '@jest/globals';
import { createAdminCaller } from './setup';

jest.mock('../../services/webhooks.service', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('tRPC webhooks router', () => {
  it('lists webhooks', async () => {
    const service = require('../../services/webhooks.service').default;
    service.getAll.mockReturnValue([{ id: 1, url: 'https://example.com' }]);

    const caller = createAdminCaller();
    const result = await caller.webhooks.list();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('creates a webhook', async () => {
    const service = require('../../services/webhooks.service').default;
    service.create.mockReturnValue({ id: 1, url: 'https://example.com', events: ['sync'] });

    const caller = createAdminCaller();
    const result = await caller.webhooks.create({
      url: 'https://example.com',
      events: ['sync'],
      secret: 'shh',
    });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it('updates a webhook', async () => {
    const service = require('../../services/webhooks.service').default;
    service.getById.mockReturnValue({ id: 1 });
    service.update.mockReturnValue(true);
    service.getById.mockReturnValue({ id: 1, url: 'https://new.com' });

    const caller = createAdminCaller();
    const result = await caller.webhooks.update({ id: 1, url: 'https://new.com' });
    expect(result.success).toBe(true);
    expect(result.data.url).toBe('https://new.com');
  });

  it('throws when updating unknown webhook', async () => {
    const service = require('../../services/webhooks.service').default;
    service.getById.mockReturnValue(null);

    const caller = createAdminCaller();
    await expect(caller.webhooks.update({ id: 99, url: 'https://x.com' })).rejects.toThrow('introuvable');
  });

  it('deletes a webhook', async () => {
    const service = require('../../services/webhooks.service').default;
    service.getById.mockReturnValue({ id: 1 });
    service.delete.mockReturnValue(true);

    const caller = createAdminCaller();
    const result = await caller.webhooks.delete({ id: 1 });
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(true);
  });

  it('throws when deleting unknown webhook', async () => {
    const service = require('../../services/webhooks.service').default;
    service.getById.mockReturnValue(null);

    const caller = createAdminCaller();
    await expect(caller.webhooks.delete({ id: 99 })).rejects.toThrow('introuvable');
  });
});
