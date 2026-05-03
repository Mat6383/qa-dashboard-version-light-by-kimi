
/**
 * Tests unitaires du service d'audit
 */

jest.mock('better-sqlite3', () => {
  const actual = jest.requireActual('better-sqlite3');
  return jest.fn(() => new actual(':memory:'));
});

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  redactSensitive: (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const result = { ...obj };
    if ('password' in result) result.password = '***REDACTED***';
    if ('api_key' in result) result.api_key = '***REDACTED***';
    return result;
  },
}));

describe('AuditService', () => {
  let auditService;

  beforeEach(() => {
    jest.resetModules();
    auditService = require('../../services/audit.service').default;
    auditService.init();
  });

  it('inserts an audit log entry', () => {
    auditService.log({
      actorId: 1,
      actorEmail: 'test@example.com',
      actorRole: 'admin',
      action: 'cache.clear',
      resource: 'cache',
      method: 'POST',
      path: '/api/cache/clear',
      statusCode: 200,
      success: true,
    });

    const result = auditService.query({ limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0].action).toBe('cache.clear');
    expect(result.data[0].actor_email).toBe('test@example.com');
    expect(result.data[0].success).toBe(true);
  });

  it('redacts sensitive data in details', () => {
    auditService.log({
      action: 'sync.config.update',
      details: { password: 'secret123', api_key: 'abc', normal: 'ok' },
    });

    const result = auditService.query({ limit: 10 });
    const details = result.data[0].details;
    expect(details.password).toBe('***REDACTED***');
    expect(details.api_key).toBe('***REDACTED***');
    expect(details.normal).toBe('ok');
  });

  it('filters by action', () => {
    auditService.log({ action: 'cache.clear' });
    auditService.log({ action: 'export.csv' });
    auditService.log({ action: 'export.pdf' });

    const result = auditService.query({ action: 'export.csv', limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0].action).toBe('export.csv');
  });

  it('supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      auditService.log({ action: 'test.action' });
    }

    const page1 = auditService.query({ limit: 2, offset: 0 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = auditService.query({ limit: 2, offset: 2 });
    expect(page2.data).toHaveLength(2);
  });

  it('prunes old records', () => {
    auditService.log({ action: 'old.action' });
    auditService.prune(-1);
    const result = auditService.query({ limit: 10 });
    expect(result.total).toBe(0);
  });

  it('handles unauthenticated actor (null user)', () => {
    auditService.log({
      action: 'cache.clear',
      actorId: null,
      actorEmail: null,
      actorRole: null,
    });

    const result = auditService.query({ limit: 10 });
    expect(result.data[0].actor_id).toBeNull();
    expect(result.data[0].actor_email).toBeNull();
  });
});
