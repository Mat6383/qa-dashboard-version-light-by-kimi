import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/testmo.service', () => ({
  __esModule: true,
  default: {
    getProjects: jest.fn(),
    getProjectMetrics: jest.fn(),
    getEscapeAndDetectionRates: jest.fn(),
    getAnnualQualityTrends: jest.fn(),
  },
}));

jest.mock('../../services/notification.service', () => ({
  __esModule: true,
  default: {
    dispatch: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/metricSnapshots.service', () => ({
  __esModule: true,
  default: {
    getTrends: jest.fn().mockReturnValue([{ date: '2026-01-01', passRate: 90 }]),
  },
}));

jest.mock('../../services/logger.service', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('tRPC dashboard router', () => {
  it('returns multi-project summary', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getProjects.mockResolvedValue([{ id: 1, name: 'Alpha' }]);
    testmoService.getProjectMetrics.mockResolvedValue({
      passRate: 90,
      completionRate: 80,
      blockedRate: 2,
      escapeRate: 5,
      detectionRate: 95,
      slaStatus: { ok: true, alerts: [] },
      timestamp: '2026-04-28T10:00:00Z',
    });

    const caller = createTestCaller();
    const result = await caller.dashboard.multiProjectSummary();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].projectName).toBe('Alpha');
  });

  it('returns metrics for a project', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getProjectMetrics.mockResolvedValue({
      passRate: 95,
      completionRate: 85,
      blockedRate: 1,
      slaStatus: { ok: true, alerts: [] },
    });

    const caller = createTestCaller();
    const result = await caller.dashboard.metrics({ projectId: 1, preprodMilestones: [], prodMilestones: [] });
    expect(result.success).toBe(true);
    expect(result.data.passRate).toBe(95);
  });

  it('returns quality rates', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getEscapeAndDetectionRates.mockResolvedValue({ escapeRate: 3, detectionRate: 97 });

    const caller = createTestCaller();
    const result = await caller.dashboard.qualityRates({ projectId: 1 });
    expect(result.success).toBe(true);
    expect(result.data.escapeRate).toBe(3);
  });

  it('returns annual trends', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getAnnualQualityTrends.mockResolvedValue([{ month: '2026-01', passRate: 92 }]);

    const caller = createTestCaller();
    const result = await caller.dashboard.annualTrends({ projectId: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('returns trends from snapshots', async () => {
    const caller = createTestCaller();
    const result = await caller.dashboard.trends({ projectId: 1, granularity: 'day' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('returns compare data for multiple projects', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getProjectMetrics.mockResolvedValue({
      passRate: 90,
      completionRate: 80,
      escapeRate: 5,
      detectionRate: 95,
      blockedRate: 2,
      projectName: 'Alpha',
    });

    const caller = createTestCaller();
    const result = await caller.dashboard.compare({ projectIds: [1, 2] });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });
});
