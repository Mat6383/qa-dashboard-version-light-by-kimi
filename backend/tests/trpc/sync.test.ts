import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/sync.service', () => ({
  __esModule: true,
  default: {
    previewIteration: jest.fn(),
    syncIteration: jest.fn(),
  },
}));

jest.mock('../../services/syncHistory.service', () => ({
  __esModule: true,
  default: {
    addRun: jest.fn(),
    getHistory: jest.fn(),
  },
}));

jest.mock('../../services/auto-sync-config.service', () => ({
  __esModule: true,
  default: {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  },
}));

jest.mock('../../services/gitlab.service', () => ({
  __esModule: true,
  default: {
    searchIterations: jest.fn(),
  },
}));

jest.mock('../../config/projects.config', () => ({
  __esModule: true,
  default: [
    { id: 'alpha', label: 'Alpha', configured: true, gitlab: { projectId: '123' } },
    { id: 'beta', label: 'Beta', configured: false, gitlab: {} },
  ],
}));

jest.mock('../../services/logger.service', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('tRPC sync router', () => {
  it('lists projects configuration', async () => {
    const caller = createTestCaller();
    const result = await caller.sync.projects();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].configured).toBe(true);
  });

  it('returns iterations for a configured project', async () => {
    const gitlab = require('../../services/gitlab.service').default;
    gitlab.searchIterations.mockResolvedValue([{ id: 1, title: 'Sprint 1', state: 'opened', web_url: 'http://x' }]);

    const caller = createTestCaller();
    const result = await caller.sync.iterations({ projectId: 'alpha', search: '' });
    expect(result.success).toBe(true);
    expect(result.data[0].title).toBe('Sprint 1');
  });

  it('throws NOT_FOUND for unknown project', async () => {
    const caller = createTestCaller();
    await expect(caller.sync.iterations({ projectId: 'unknown', search: '' })).rejects.toThrow('inconnu');
  });

  it('throws BAD_REQUEST for unconfigured project', async () => {
    const caller = createTestCaller();
    await expect(caller.sync.iterations({ projectId: 'beta', search: '' })).rejects.toThrow('non configuré');
  });

  it('returns preview for an iteration', async () => {
    const syncService = require('../../services/sync.service').default;
    syncService.previewIteration.mockResolvedValue({ summary: { toCreate: 1, toUpdate: 2, toSkip: 0, total: 3 }, items: [] });

    const caller = createTestCaller();
    const result = await caller.sync.preview({ projectId: 'alpha', iterationName: 'Sprint 1' });
    expect(result.success).toBe(true);
    expect(result.data.summary.total).toBe(3);
  });

  it('returns sync history', async () => {
    const history = require('../../services/syncHistory.service').default;
    history.getHistory.mockReturnValue([{ id: 1, project: 'Alpha', iteration: 'S1' }]);

    const caller = createTestCaller();
    const result = await caller.sync.history();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('runs iteration sync', async () => {
    const syncService = require('../../services/sync.service').default;
    syncService.syncIteration.mockResolvedValue({ created: 1, updated: 0 });

    const caller = createTestCaller();
    const result = await caller.sync.iteration({ iteration: 'Sprint 1', isTest: false, dryRun: false });
    expect(result.success).toBe(true);
    expect(result.data.created).toBe(1);
  });

  it('returns auto config', async () => {
    const autoSync = require('../../services/auto-sync-config.service').default;
    autoSync.getConfig.mockReturnValue({ enabled: true });

    const caller = createTestCaller();
    const result = await caller.sync.autoConfig();
    expect(result.success).toBe(true);
    expect(result.data.enabled).toBe(true);
  });

  it('updates auto config', async () => {
    const autoSync = require('../../services/auto-sync-config.service').default;
    autoSync.updateConfig.mockReturnValue({ enabled: false });

    const caller = createTestCaller();
    const result = await caller.sync.updateAutoConfig({ enabled: false });
    expect(result.success).toBe(true);
    expect(result.data.enabled).toBe(false);
  });
});
