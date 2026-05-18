/**
 * ================================================
 * USE TEMPORAL COMPARISON — Hook de comparaison temporelle
 * ================================================
 * Fetches historical trends and computes deltas vs J-7 / J-14 / J-30
 * for each KPI metric. Used by Option C "Pro Suite" inline comparison.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api.service';

export interface TemporalValue {
  value: number | null;
  date: string;
}

export interface MetricTemporal {
  current: number;
  delta7: number | null;
  delta14: number | null;
  delta30: number | null;
  values: {
    j7: TemporalValue | null;
    j14: TemporalValue | null;
    j30: TemporalValue | null;
  };
}

export type TemporalComparisonMap = Partial<Record<string, MetricTemporal>>;

type MetricKey = 'pass_rate' | 'completion_rate' | 'escape_rate' | 'detection_rate' | 'blocked_rate' | 'total_tests';

interface TrendSnapshot {
  date: string;
  pass_rate: number | null;
  completion_rate: number | null;
  escape_rate: number | null;
  detection_rate: number | null;
  blocked_rate: number | null;
  total_tests: number | null;
}

function getMetricKeyFromName(name: string): string {
  const map: Record<string, string> = {
    completionRate: 'completion_rate',
    passRate: 'pass_rate',
    failureRate: 'failure_rate',
    blockedRate: 'blocked_rate',
    escapeRate: 'escape_rate',
    detectionRate: 'detection_rate',
    testEfficiency: 'pass_rate', // test efficiency ≈ pass rate historically
  };
  return map[name] || name;
}

function findClosestSnapshot(data: TrendSnapshot[], targetDate: Date): TrendSnapshot | null {
  const targetTs = targetDate.getTime();
  let closest: TrendSnapshot | null = null;
  let closestDiff = Infinity;

  for (const snapshot of data) {
    const snapshotDate = new Date(snapshot.date);
    const diff = Math.abs(snapshotDate.getTime() - targetTs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = snapshot;
    }
  }

  // Only accept if within 2 days of target
  if (closestDiff > 2 * 24 * 60 * 60 * 1000) return null;
  return closest;
}

function computeDelta(current: number, previous: number | null): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return parseFloat((current - previous).toFixed(2));
}

export function useTemporalComparison(projectId: number | null, enabled = true) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['dashboard-temporal-comparison', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const res = await apiClient.get(`/dashboard/${projectId}/trends`, {
        params: { granularity: 'day', from, to },
      });
      return (res.data?.snapshots || []) as TrendSnapshot[];
    },
    enabled: !!projectId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  const comparison: TemporalComparisonMap = useMemo(() => {
    if (!data.length) return {};

    const now = new Date();
    const j7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const j14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const j30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const snapshot7 = findClosestSnapshot(data, j7);
    const snapshot14 = findClosestSnapshot(data, j14);
    const snapshot30 = findClosestSnapshot(data, j30);

    const buildMetricTemporal = (
      current: number,
      key: MetricKey
    ): MetricTemporal => {
      const v7 = snapshot7?.[key] ?? null;
      const v14 = snapshot14?.[key] ?? null;
      const v30 = snapshot30?.[key] ?? null;

      return {
        current,
        delta7: computeDelta(current, v7),
        delta14: computeDelta(current, v14),
        delta30: computeDelta(current, v30),
        values: {
          j7: v7 !== null ? { value: v7, date: snapshot7!.date } : null,
          j14: v14 !== null ? { value: v14, date: snapshot14!.date } : null,
          j30: v30 !== null ? { value: v30, date: snapshot30!.date } : null,
        },
      };
    };

    // We return a map keyed by metric names used in the frontend
    return {
      completionRate: buildMetricTemporal(0, 'completion_rate'),
      passRate: buildMetricTemporal(0, 'pass_rate'),
      failureRate: buildMetricTemporal(0, 'blocked_rate'), // fallback
      blockedRate: buildMetricTemporal(0, 'blocked_rate'),
      escapeRate: buildMetricTemporal(0, 'escape_rate'),
      detectionRate: buildMetricTemporal(0, 'detection_rate'),
      testEfficiency: buildMetricTemporal(0, 'pass_rate'),
    };
  }, [data]);

  const getTemporalForMetric = (metricName: string, currentValue: number): MetricTemporal | null => {
    const key = getMetricKeyFromName(metricName);
    const base = comparison[key];
    if (!base) return null;
    // Recompute with actual current value (since we used 0 as placeholder above)
    return {
      ...base,
      current: currentValue,
      delta7: computeDelta(currentValue, base.values.j7?.value ?? null),
      delta14: computeDelta(currentValue, base.values.j14?.value ?? null),
      delta30: computeDelta(currentValue, base.values.j30?.value ?? null),
    };
  };

  return { comparison, getTemporalForMetric, isLoading };
}
