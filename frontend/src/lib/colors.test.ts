import { describe, it, expect } from 'vitest';
import { getMetricLevel, getMetricColor, METRIC_THRESHOLDS } from './colors';

describe('getMetricLevel', () => {
  it('returns success for passRate >= target', () => {
    expect(getMetricLevel('passRate', 95)).toBe('success');
    expect(getMetricLevel('passRate', 100)).toBe('success');
  });

  it('returns warning for passRate in window', () => {
    expect(getMetricLevel('passRate', 90)).toBe('warning');
    expect(getMetricLevel('passRate', 85)).toBe('warning');
  });

  it('returns danger for passRate below warning', () => {
    expect(getMetricLevel('passRate', 84)).toBe('danger');
    expect(getMetricLevel('passRate', 0)).toBe('danger');
  });

  it('returns success for inverse metric (failureRate) <= target', () => {
    expect(getMetricLevel('failureRate', 5)).toBe('success');
    expect(getMetricLevel('failureRate', 0)).toBe('success');
  });

  it('returns warning for inverse metric in window', () => {
    expect(getMetricLevel('failureRate', 8)).toBe('warning');
    expect(getMetricLevel('failureRate', 10)).toBe('warning');
  });

  it('returns danger for inverse metric above warning', () => {
    expect(getMetricLevel('failureRate', 11)).toBe('danger');
    expect(getMetricLevel('failureRate', 50)).toBe('danger');
  });

  it('handles edge cases for escapeRate', () => {
    expect(getMetricLevel('escapeRate', 4)).toBe('success');
    expect(getMetricLevel('escapeRate', 5)).toBe('success');
    expect(getMetricLevel('escapeRate', 6)).toBe('warning');
    expect(getMetricLevel('escapeRate', 10)).toBe('warning');
    expect(getMetricLevel('escapeRate', 11)).toBe('danger');
  });

  it('returns warning for unknown metric', () => {
    expect(getMetricLevel('unknownMetric' as any, 50)).toBe('warning');
  });
});

describe('getMetricColor', () => {
  it('returns correct CSS variable for passRate', () => {
    expect(getMetricColor('passRate', 95)).toBe('var(--status-success)');
    expect(getMetricColor('passRate', 85)).toBe('var(--status-warning)');
    expect(getMetricColor('passRate', 80)).toBe('var(--status-danger)');
  });

  it('returns correct CSS variable for failureRate (inverse)', () => {
    expect(getMetricColor('failureRate', 3)).toBe('var(--status-success)');
    expect(getMetricColor('failureRate', 7)).toBe('var(--status-warning)');
    expect(getMetricColor('failureRate', 15)).toBe('var(--status-danger)');
  });
});

describe('METRIC_THRESHOLDS', () => {
  it('has all expected metrics configured', () => {
    expect(METRIC_THRESHOLDS).toHaveProperty('completionRate');
    expect(METRIC_THRESHOLDS).toHaveProperty('passRate');
    expect(METRIC_THRESHOLDS).toHaveProperty('failureRate');
    expect(METRIC_THRESHOLDS).toHaveProperty('testEfficiency');
    expect(METRIC_THRESHOLDS).toHaveProperty('escapeRate');
    expect(METRIC_THRESHOLDS).toHaveProperty('detectionRate');
    expect(METRIC_THRESHOLDS).toHaveProperty('blockedRate');
  });
});
