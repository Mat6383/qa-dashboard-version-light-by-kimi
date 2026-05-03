import { describe, it, expect, jest } from '@jest/globals';
import { createTestCaller } from './setup';

jest.mock('../../services/gitlab.service', () => ({
  __esModule: true,
  default: {
    searchIterations: jest.fn(),
    getIssuesByLabelAndIterationForProject: jest.fn(),
  },
}));

jest.mock('../../services/comments.service', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('tRPC crosstest router', () => {
  it('returns iterations', async () => {
    const gitlab = require('../../services/gitlab.service').default;
    gitlab.searchIterations.mockResolvedValue([{ id: 1, title: 'It 1', state: 'opened' }]);

    const caller = createTestCaller();
    const result = await caller.crosstest.iterations({ search: 'It' });
    expect(result.success).toBe(true);
    expect(result.data[0].title).toBe('It 1');
  });

  it('returns issues by iteration', async () => {
    const gitlab = require('../../services/gitlab.service').default;
    gitlab.getIssuesByLabelAndIterationForProject.mockResolvedValue([
      { iid: 1, title: 'Issue 1', web_url: 'http://x', state: 'opened', assignees: [{ name: 'Alice' }], labels: ['CrossTest::OK', 'bug'], created_at: '2026-01-01', closed_at: null },
    ]);

    const caller = createTestCaller();
    const result = await caller.crosstest.issues({ iterationId: 1 });
    expect(result.success).toBe(true);
    expect(result.data[0].iid).toBe(1);
    expect(result.data[0].labels).not.toContain('CrossTest::OK');
  });

  it('returns all comments', async () => {
    const comments = require('../../services/comments.service').default;
    comments.getAll.mockReturnValue([{ issue_iid: 1, comment: 'OK' }]);

    const caller = createTestCaller();
    const result = await caller.crosstest.comments();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('saves a comment', async () => {
    const comments = require('../../services/comments.service').default;
    comments.upsert.mockReturnValue({ issue_iid: 1, comment: 'Note' });

    const caller = createTestCaller();
    const result = await caller.crosstest.saveComment({ issue_iid: 1, comment: 'Note', milestone_context: null });
    expect(result.success).toBe(true);
    expect(result.data.comment).toBe('Note');
  });

  it('deletes a comment', async () => {
    const comments = require('../../services/comments.service').default;
    comments.delete.mockReturnValue(true);

    const caller = createTestCaller();
    const result = await caller.crosstest.deleteComment({ iid: 1 });
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(true);
  });
});
