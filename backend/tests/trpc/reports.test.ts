import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/testmo.service', () => ({
  __esModule: true,
  default: {
    apiGet: jest.fn(),
  },
}));

jest.mock('../../services/report.service', () => {
  return jest.fn().mockImplementation(() => ({
    collectReportData: jest.fn().mockResolvedValue({
      milestoneName: 'M1',
      verdict: 'Passed',
      stats: { totalTests: 100, passRate: 95 },
      failedTests: [],
    }),
    generateHTML: jest.fn().mockReturnValue('<html>report</html>'),
    generatePPTX: jest.fn().mockResolvedValue({
      write: jest.fn().mockResolvedValue(Buffer.from('pptx')),
    }),
  }));
});

jest.mock('../../services/logger.service', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../middleware/metrics', () => ({
  exportRunsTotal: { inc: jest.fn() },
}));

describe('tRPC reports router', () => {
  it('generates report with runIds', async () => {
    const caller = createTestCaller();
    const result = await caller.reports.generate({
      projectId: 1,
      runIds: [10, 20],
      formats: { html: true },
    });
    expect(result.success).toBe(true);
    expect(result.files.html).toBeDefined();
    expect(result.summary.verdict).toBe('Passed');
  });

  it('falls back to milestoneId when runIds absent', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.apiGet.mockResolvedValue({
      result: [{ id: 5, milestone_id: 100 }, { id: 6, milestone_id: 200 }],
    });

    const caller = createTestCaller();
    const result = await caller.reports.generate({
      projectId: 1,
      milestoneId: 100,
      formats: { html: true },
    });
    expect(result.success).toBe(true);
    expect(result.summary.verdict).toBe('Passed');
  });

  it('throws when no runs found for milestone', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.apiGet.mockResolvedValue({ result: [] });

    const caller = createTestCaller();
    await expect(
      caller.reports.generate({
        projectId: 1,
        milestoneId: 999,
        formats: { html: true },
      })
    ).rejects.toThrow('Aucun run');
  });
});
