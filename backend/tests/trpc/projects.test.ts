import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/testmo.service', () => ({
  __esModule: true,
  default: {
    getProjects: jest.fn(),
    getProjectRuns: jest.fn(),
    getProjectMilestones: jest.fn(),
    getAutomationRuns: jest.fn(),
  },
}));

describe('tRPC projects router', () => {
  it('lists projects', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getProjects.mockResolvedValue([{ id: 1, name: 'Alpha' }]);

    const caller = createTestCaller();
    const result = await caller.projects.list();
    expect(result.success).toBe(true);
    expect(result.data.result).toEqual([{ id: 1, name: 'Alpha' }]);
  });

  it('returns runs for a project', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getProjectRuns.mockResolvedValue([{ id: 10, name: 'Run 1' }]);

    const caller = createTestCaller();
    const result = await caller.projects.runs({ projectId: 1, active: true });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('returns milestones for a project', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getProjectMilestones.mockResolvedValue([{ id: 5, name: 'M1' }]);

    const caller = createTestCaller();
    const result = await caller.projects.milestones({ projectId: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('returns automation runs for a project', async () => {
    const testmoService = require('../../services/testmo.service').default;
    testmoService.getAutomationRuns.mockResolvedValue([{ id: 99, name: 'Auto' }]);

    const caller = createTestCaller();
    const result = await caller.projects.automation({ projectId: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});
