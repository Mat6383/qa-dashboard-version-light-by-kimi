import { getMetricLevel } from './colors';
import type { KpiStatus, KpiTrend } from '../types/api.types';

export function getKpiStatus(metricName: string, value: number): KpiStatus {
  const level = getMetricLevel(metricName, value);
  if (level === 'success') return 'ok';
  if (level === 'warning') return 'warning';
  return 'critical';
}

export function getKpiTrend(metricName: string, value: number): KpiTrend {
  const level = getMetricLevel(metricName, value);
  if (level === 'success') return 'up';
  if (level === 'danger') return 'down';
  return 'neutral';
}

export function getProgressColor(value: number): string {
  if (value >= 80) return 'var(--status-success)';
  if (value >= 50) return 'var(--status-info)';
  if (value >= 25) return 'var(--status-warning)';
  return 'var(--status-danger)';
}
