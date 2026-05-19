import React from 'react';
import { Activity, CheckSquare, XCircle, TrendingUp } from 'lucide-react';
import KPICard from '../KPICard';
import { getKpiStatus, getKpiTrend } from '../../lib/kpiHelpers';
import type { DashboardMetrics, RawMetrics, MetricAlert, MetricTemporal } from '../../types/api.types';
import type { WidgetId } from '../../hooks/useDashboardLayout';

interface KPIWidgetProps {
  widgetId: WidgetId;
  metrics: DashboardMetrics;
  raw: RawMetrics;
  useBusiness: boolean;
  getAlertForMetric?: (metric: string) => MetricAlert | undefined;
  getTemporalForMetric?: (metricName: string, currentValue: number) => MetricTemporal | null;
  onExportCard?: (element: HTMLElement, title: string) => void;
}

function buildPills(t: MetricTemporal | null) {
  if (!t) return null;
  const pills = [];
  if (t.values.j7?.value != null) {
    pills.push({ label: 'J-7', value: `${Math.round(t.values.j7.value)}%` });
  }
  if (t.values.j14?.value != null) {
    pills.push({ label: 'J-14', value: `${Math.round(t.values.j14.value)}%` });
  }
  if (t.values.j30?.value != null) {
    pills.push({ label: 'J-30', value: `${Math.round(t.values.j30.value)}%` });
  }
  return pills.length > 0 ? pills : null;
}

const WIDGET_CONFIG: Record<string, {
  titleFr: string;
  titleEn: string;
  icon: React.ReactNode;
  metricKey: keyof DashboardMetrics;
  subtitle: (m: DashboardMetrics, r: RawMetrics, biz: boolean) => string;
  alertMetric: string;
  progressLabel: (m: DashboardMetrics, r: RawMetrics) => string;
  invertDelta?: boolean;
}> = {
  completionRate: {
    titleFr: "Taux d'Exécution",
    titleEn: 'Execution Rate',
    icon: <Activity size={20} />,
    metricKey: 'completionRate',
    subtitle: (m, r, biz) => `${r.completed} / ${r.total} ${biz ? 'tests exécutés' : 'tests executed'} (Cible: ≥ 90%)`,
    alertMetric: 'Completion Rate',
    progressLabel: (_m, r) => `${r.completed} / ${r.total}`,
  },
  passRate: {
    titleFr: 'Taux de Succès',
    titleEn: 'Pass Rate',
    icon: <CheckSquare size={20} />,
    metricKey: 'passRate',
    subtitle: (m, r, biz) => `${r.passed} / ${r.total} ${biz ? 'tests réussis' : 'tests passed'} (Cible: ≥ 95%)`,
    alertMetric: 'Pass Rate',
    progressLabel: (_m, r) => `${r.passed} / ${r.total}`,
  },
  failureRate: {
    titleFr: "Taux d'Échec",
    titleEn: 'Failure Rate',
    icon: <XCircle size={20} />,
    metricKey: 'failureRate',
    subtitle: (m, r, biz) => `${r.failed} / ${r.total} ${biz ? 'tests échoués' : 'tests failed'} (Cible: ≤ 5%)`,
    alertMetric: 'Failure Rate',
    progressLabel: (_m, r) => `${r.failed} / ${r.total}`,
    invertDelta: true,
  },
  testEfficiency: {
    titleFr: 'Efficience des tests',
    titleEn: 'Test Efficiency',
    icon: <TrendingUp size={20} />,
    metricKey: 'testEfficiency',
    subtitle: (m, r, biz) => `${r.passed} / ${r.passed + r.failed} (Cible: ≥ 95%)`,
    alertMetric: 'Test Efficiency',
    progressLabel: (_m, r) => `${r.passed} / ${r.passed + r.failed}`,
  },
};

export default function KPIWidget({
  widgetId,
  metrics,
  raw,
  useBusiness,
  getAlertForMetric,
  getTemporalForMetric,
  onExportCard,
}: KPIWidgetProps) {
  const cfg = WIDGET_CONFIG[widgetId];
  if (!cfg) return null;

  const value = Math.round(metrics[cfg.metricKey] as number);
  const t = getTemporalForMetric?.(widgetId, metrics[cfg.metricKey] as number);
  const title = useBusiness ? cfg.titleFr : cfg.titleEn;

  // Trend basé sur le delta temporel (J-7) quand disponible
  const temporalTrend: import('../../types/api.types').KpiTrend | undefined =
    t?.delta7 != null ? (t.delta7 > 0 ? 'up' : t.delta7 < 0 ? 'down' : 'neutral') : undefined;
  const trendValue = t?.delta7 != null ? `${t.delta7 > 0 ? '+' : ''}${t.delta7}%` : undefined;

  return (
    <KPICard
      title={title}
      icon={cfg.icon}
      value={value}
      status={getKpiStatus(widgetId, value)}
      trend={temporalTrend ?? getKpiTrend(widgetId, value)}
      trendValue={trendValue}
      subtitle={cfg.subtitle(metrics, raw, useBusiness)}
      alert={getAlertForMetric?.(cfg.alertMetric)}
      progress={{ value: metrics[cfg.metricKey] as number, label: cfg.progressLabel(metrics, raw) }}
      delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
      invertDeltaColors={cfg.invertDelta}
      comparisonPills={buildPills(t)}
      onExport={onExportCard ? (el) => onExportCard(el, title) : null}
    />
  );
}
