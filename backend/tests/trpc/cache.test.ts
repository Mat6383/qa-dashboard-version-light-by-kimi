import { describe, it, expect, jest } from '@jest/globals';
import { createAdminCaller } from './setup';

jest.mock('../../services/testmo.service', () => ({
  __esModule: true,
  default: {
    clearCache: jest.fn(),
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

describe('tRPC cache router', () => {
  it('clears cache via admin procedure', async () => {
    const caller = createAdminCaller();
    const result = await caller.cache.clear();
    expect(result.success).toBe(true);
    expect(result.message).toBe('Cache cleared successfully');
  });
});
