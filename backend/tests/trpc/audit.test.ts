import { describe, it, expect, jest } from '@jest/globals';
import { createAdminCaller } from './setup';

jest.mock('../../services/audit.service', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('tRPC audit router', () => {
  it('returns audit logs with filters', async () => {
    const service = require('../../services/audit.service').default;
    service.query.mockReturnValue({ rows: [{ id: 1, action: 'login' }], total: 1 });

    const caller = createAdminCaller();
    const result = await caller.audit.logs({ action: 'login', limit: 10 });
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('returns audit logs without filters', async () => {
    const service = require('../../services/audit.service').default;
    service.query.mockReturnValue({ rows: [], total: 0 });

    const caller = createAdminCaller();
    const result = await caller.audit.logs();
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(0);
  });
});
