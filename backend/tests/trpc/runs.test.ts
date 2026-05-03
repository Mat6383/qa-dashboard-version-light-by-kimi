import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/testmo.service', () => ({
  __esModule: true,
  default: {
    getRunDetails: jest.fn(),
    getRunResults: jest.fn(),
  },
}));

describe('tRPC runs router', () => {
  it('returns run details', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getRunDetails.mockResolvedValue({ id: 1, name: 'Run A' });

    const caller = createTestCaller();
    const result = await caller.runs.details({ runId: 1 });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Run A');
  });

  it('returns run results with optional status', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getRunResults.mockResolvedValue([{ id: 1, status: 'passed' }]);

    const caller = createTestCaller();
    const result = await caller.runs.results({ runId: 1, status: 'passed' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});
