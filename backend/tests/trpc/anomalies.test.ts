import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/anomaly.service', () => ({
  __esModule: true,
  detectAnomalies: jest.fn(),
}));

jest.mock('../../services/testmo.service', () => ({
  __esModule: true,
  default: {},
  testmoBreaker: { getStatus: jest.fn(() => ({ name: 'testmo', state: 'CLOSED' })) },
}));

jest.mock('../../services/gitlab.service', () => ({
  __esModule: true,
  default: {},
  gitlabBreaker: { getStatus: jest.fn(() => ({ name: 'gitlab', state: 'CLOSED' })) },
}));

jest.mock('../../services/status-sync.service', () => ({
  __esModule: true,
  statusSyncBreaker: { getStatus: jest.fn(() => ({ name: 'statusSync', state: 'CLOSED' })) },
}));

describe('tRPC anomalies router', () => {
  it('returns anomalies list for a project', async () => {
    const { detectAnomalies } = require('../../services/anomaly.service');
    detectAnomalies.mockReturnValue([
      { metric: 'pass_rate', severity: 'critical', zScore: -3.2 },
    ]);

    const caller = createTestCaller();
    const result = await caller.anomalies.list({ projectId: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.hasAnomaly).toBe(true);
  });

  it('returns circuit breakers status', async () => {
    const caller = createTestCaller();
    const result = await caller.anomalies.circuitBreakers();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(result.data.map((d: any) => d.name)).toEqual(['testmo', 'gitlab', 'statusSync']);
  });
});
