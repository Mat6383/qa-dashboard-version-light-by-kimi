
/**
 * Tests des métriques Prometheus
 */

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Prometheus Metrics', () => {
  let metrics;

  beforeAll(() => {
    // Load once to avoid duplicate metric registration errors
    metrics = require('../../middleware/metrics');
  });

  it('registers business-level metrics', () => {
    expect(typeof metrics.activeUsersGauge).toBe('object');
    expect(typeof metrics.dbSizeGauge).toBe('object');
    expect(typeof metrics.syncRunsTotal).toBe('object');
    expect(typeof metrics.exportRunsTotal).toBe('object');
    expect(typeof metrics.alertThresholdGauge).toBe('object');
  });

  it('increments activeUsersGauge without error', () => {
    expect(() => metrics.activeUsersGauge.inc()).not.toThrow();
    expect(() => metrics.activeUsersGauge.dec()).not.toThrow();
  });

  it('increments syncRunsTotal with status label', () => {
    expect(() => metrics.syncRunsTotal.inc({ status: 'success' })).not.toThrow();
    expect(() => metrics.syncRunsTotal.inc({ status: 'failure' })).not.toThrow();
  });

  it('increments exportRunsTotal with format label', () => {
    expect(() => metrics.exportRunsTotal.inc({ format: 'pdf' })).not.toThrow();
    expect(() => metrics.exportRunsTotal.inc({ format: 'csv' })).not.toThrow();
  });

  it('exposes updateDbSizeMetrics function', () => {
    expect(typeof metrics.updateDbSizeMetrics).toBe('function');
    expect(() => metrics.updateDbSizeMetrics()).not.toThrow();
  });
});
