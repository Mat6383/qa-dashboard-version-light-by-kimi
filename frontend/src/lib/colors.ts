export type MetricLevel = 'success' | 'warning' | 'danger';

export interface MetricThreshold {
  target: number;
  warning: number;
  inverse?: boolean;
}

export const METRIC_THRESHOLDS: Record<string, MetricThreshold> = {
  completionRate: { target: 90, warning: 80 },
  passRate: { target: 95, warning: 85 },
  failureRate: { target: 5, warning: 10, inverse: true },
  testEfficiency: { target: 95, warning: 85 },
  escapeRate: { target: 5, warning: 10, inverse: true },
  detectionRate: { target: 95, warning: 85 },
  blockedRate: { target: 5, warning: 10, inverse: true },
};

export function getMetricLevel(
  metricName: keyof typeof METRIC_THRESHOLDS | string,
  value: number
): MetricLevel {
  const config = METRIC_THRESHOLDS[metricName];
  if (!config) return 'warning';

  const { target, warning, inverse } = config;

  if (inverse) {
    if (value <= target) return 'success';
    if (value <= warning) return 'warning';
    return 'danger';
  }

  if (value >= target) return 'success';
  if (value >= warning) return 'warning';
  return 'danger';
}

export function getMetricColor(
  metricName: keyof typeof METRIC_THRESHOLDS | string,
  value: number
): string {
  const level = getMetricLevel(metricName, value);
  switch (level) {
    case 'success':
      return 'var(--status-success)';
    case 'warning':
      return 'var(--status-warning)';
    case 'danger':
      return 'var(--status-danger)';
  }
}

export function getMetricBgColor(
  metricName: keyof typeof METRIC_THRESHOLDS | string,
  value: number
): string {
  const level = getMetricLevel(metricName, value);
  switch (level) {
    case 'success':
      return 'var(--status-success-bg)';
    case 'warning':
      return 'var(--status-warning-bg)';
    case 'danger':
      return 'var(--status-danger-bg)';
  }
}

export function getMetricBorderColor(
  metricName: keyof typeof METRIC_THRESHOLDS | string,
  value: number
): string {
  const level = getMetricLevel(metricName, value);
  switch (level) {
    case 'success':
      return 'var(--status-success-border)';
    case 'warning':
      return 'var(--status-warning-border)';
    case 'danger':
      return 'var(--status-danger-border)';
  }
}
