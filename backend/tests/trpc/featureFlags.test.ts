import { describe, it, expect, jest } from '@jest/globals';
import { createAdminCaller, createTestCaller } from './setup';

jest.mock('../../services/featureFlags.service', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    isEnabled: jest.fn(),
    getByKey: jest.fn(),
    getAllDetails: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('tRPC featureFlags router', () => {
  it('lists flags for public', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getAll.mockReturnValue({ annualTrendsV2: true });

    const caller = createTestCaller();
    const result = await caller.featureFlags.list({ userId: 'u1' });
    expect(result.success).toBe(true);
    expect(result.data.annualTrendsV2).toBe(true);
  });

  it('gets a single flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.isEnabled.mockReturnValue(true);
    service.getByKey.mockReturnValue({ key: 'annualTrendsV2', enabled: true, rolloutPercentage: 50 });

    const caller = createTestCaller();
    const result = await caller.featureFlags.get({ key: 'annualTrendsV2', userId: 'u1' });
    expect(result.success).toBe(true);
    expect(result.data.enabled).toBe(true);
    expect(result.data.rolloutPercentage).toBe(50);
  });

  it('lists admin details', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getAllDetails.mockReturnValue([{ key: 'x', enabled: true }]);

    const caller = createAdminCaller();
    const result = await caller.featureFlags.listAdmin();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('creates a flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getByKey.mockReturnValueOnce(null).mockReturnValueOnce({ key: 'newFlag', enabled: false });
    service.create.mockReturnValue(true);

    const caller = createAdminCaller();
    const result = await caller.featureFlags.create({ key: 'newFlag', enabled: false });
    expect(result.success).toBe(true);
    expect(result.data.key).toBe('newFlag');
  });

  it('throws when creating duplicate flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getByKey.mockReturnValue({ key: 'existing' });

    const caller = createAdminCaller();
    await expect(caller.featureFlags.create({ key: 'existing' })).rejects.toThrow('existe déjà');
  });

  it('updates a flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getByKey.mockReturnValueOnce({ key: 'x' }).mockReturnValueOnce({ key: 'x', enabled: true });
    service.update.mockReturnValue(true);

    const caller = createAdminCaller();
    const result = await caller.featureFlags.update({ key: 'x', enabled: true });
    expect(result.success).toBe(true);
    expect(result.data.enabled).toBe(true);
  });

  it('throws when updating unknown flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getByKey.mockReturnValue(null);

    const caller = createAdminCaller();
    await expect(caller.featureFlags.update({ key: 'unknown', enabled: true })).rejects.toThrow('introuvable');
  });

  it('deletes a flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getByKey.mockReturnValue({ key: 'x' });
    service.delete.mockReturnValue(true);

    const caller = createAdminCaller();
    const result = await caller.featureFlags.delete({ key: 'x' });
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(true);
  });

  it('throws when deleting unknown flag', async () => {
    const service = require('../../services/featureFlags.service').default;
    service.getByKey.mockReturnValue(null);

    const caller = createAdminCaller();
    await expect(caller.featureFlags.delete({ key: 'unknown' })).rejects.toThrow('introuvable');
  });
});
