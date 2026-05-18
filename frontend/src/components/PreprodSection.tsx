/**
 * ================================================
 * PREPROD SECTION — Dashboard4 Préproduction v3
 * ================================================
 * Option C "Pro Suite" enhancements:
 * - Sortable KPI grid (drag & drop)
 * - Temporal comparison deltas (J-7 / J-14 / J-30)
 * - Per-card export (PNG/PDF)
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 3.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { Activity, CheckSquare, XCircle, TrendingUp, BarChart3, Database, Search, Download } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import KPICard from './KPICard';
import { getMetricColor, getMetricLevel } from '../lib/colors';
import { buildChartOptions, buildDoughnutChartData } from '../lib/charts';
import type {
  DashboardMetrics,
  RawMetrics,
  Run,
  MetricAlert,
  KpiStatus,
  KpiTrend,
  AnomalyItem,
  MetricTemporal,
} from '../types/api.types';
import type { WidgetId, SectionType } from '../hooks/useDashboardLayout';
import '../styles/PreprodSection.css';

ChartJS.register(ArcElement, Tooltip, Legend);

function getKpiStatus(metricName: string, value: number): KpiStatus {
  const level = getMetricLevel(metricName, value);
  if (level === 'success') return 'ok';
  if (level === 'warning') return 'warning';
  return 'critical';
}

function getKpiTrend(metricName: string, value: number): KpiTrend {
  const level = getMetricLevel(metricName, value);
  if (level === 'success') return 'up';
  if (level === 'danger') return 'down';
  return 'neutral';
}

function getProgressColor(value: number): string {
  if (value >= 80) return 'var(--status-success)';
  if (value >= 50) return 'var(--status-info)';
  if (value >= 25) return 'var(--status-warning)';
  return 'var(--status-danger)';
}

/* ── Sortable wrapper for KPI card ─────────────────────────────── */

interface SortableKPIProps {
  id: string;
  children: React.ReactNode;
  dragEnabled?: boolean;
}

function SortableKPI({ id, children, dragEnabled }: SortableKPIProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !dragEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-kpi-wrapper">
      {dragEnabled && (
        <div className="sortable-kpi-wrapper__handle" {...attributes} {...listeners} tabIndex={0} role="button" aria-label="Déplacer ce widget">
          <GripVertical size={16} />
        </div>
      )}
      {children}
    </div>
  );
}

/* ── PreprodSection Props ──────────────────────────────────────── */

interface PreprodSectionProps {
  metrics: DashboardMetrics;
  raw: RawMetrics;
  sortedRuns: Run[];
  originalRunsCount?: number;
  showAllRuns: boolean;
  setShowAllRuns: (show: boolean) => void;
  showLatestOnly?: boolean;
  setShowLatestOnly?: (show: boolean) => void;
  isDark: boolean;
  useBusiness: boolean;
  getAlertForMetric: (metric: string) => MetricAlert | undefined;
  anomalies: AnomalyItem[];
  // Option C
  layout?: WidgetId[];
  onMoveWidget?: (section: SectionType, oldIndex: number, newIndex: number) => void;
  dragEnabled?: boolean;
  getTemporalForMetric?: (metricName: string, currentValue: number) => MetricTemporal | null;
  onExportCard?: (element: HTMLElement, title: string) => void;
  onExportDoughnut?: (element: HTMLElement) => void;
}

const PREPROD_WIDGET_ORDER: WidgetId[] = ['completionRate', 'passRate', 'failureRate', 'testEfficiency'];

export default function PreprodSection({
  metrics,
  raw,
  sortedRuns,
  originalRunsCount,
  showAllRuns,
  setShowAllRuns,
  showLatestOnly = false,
  setShowLatestOnly,
  isDark,
  useBusiness,
  getAlertForMetric,
  anomalies,
  layout,
  onMoveWidget,
  dragEnabled = false,
  getTemporalForMetric,
  onExportCard,
  onExportDoughnut,
}: PreprodSectionProps) {
  const d1 = metrics;

  const statusChartData = useMemo(() => buildDoughnutChartData(raw, useBusiness, isDark), [raw, useBusiness, isDark]);

  const statusChartOptions = useMemo(() => buildChartOptions('doughnut', isDark), [isDark]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event: any) => {
        const { active } = event;
        const node = active?.rect?.current?.translated;
        return node ? { x: node.left, y: node.top } : { x: 0, y: 0 };
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id && onMoveWidget) {
        const items = layout || PREPROD_WIDGET_ORDER;
        const oldIndex = items.indexOf(active.id as WidgetId);
        const newIndex = items.indexOf(over.id as WidgetId);
        if (oldIndex !== -1 && newIndex !== -1) {
          onMoveWidget('preprod', oldIndex, newIndex);
        }
      }
    },
    [layout, onMoveWidget]
  );

  const widgetOrder = layout || PREPROD_WIDGET_ORDER;

  const renderWidget = (widgetId: WidgetId) => {
    const temporal = getTemporalForMetric
      ? getTemporalForMetric(widgetId, 0)
      : null;

    const buildPills = (t: MetricTemporal | null) => {
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
    };

    switch (widgetId) {
      case 'completionRate': {
        const t = getTemporalForMetric?.('completionRate', d1.completionRate);
        return (
          <KPICard
            title={useBusiness ? "Taux d'Exécution" : 'Execution Rate'}
            icon={<Activity size={20} />}
            value={Math.round(d1.completionRate)}
            status={getKpiStatus('completionRate', d1.completionRate)}
            trend={getKpiTrend('completionRate', d1.completionRate)}
            subtitle={`${raw.completed} / ${raw.total} ${useBusiness ? 'tests exécutés' : 'tests executed'} (Cible: ≥ 90%)`}
            alert={getAlertForMetric('Completion Rate')}
            progress={{ value: d1.completionRate, label: `${raw.completed} / ${raw.total}` }}
            delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
            comparisonPills={buildPills(t)}
            onExport={onExportCard ? (el) => onExportCard(el, useBusiness ? "Taux d'Exécution" : 'Execution Rate') : null}
          />
        );
      }
      case 'passRate': {
        const t = getTemporalForMetric?.('passRate', d1.passRate);
        return (
          <KPICard
            title={useBusiness ? 'Taux de Succès' : 'Pass Rate'}
            icon={<CheckSquare size={20} />}
            value={Math.round(d1.passRate)}
            status={getKpiStatus('passRate', d1.passRate)}
            trend={getKpiTrend('passRate', d1.passRate)}
            subtitle={`${raw.passed} / ${raw.total} ${useBusiness ? 'tests réussis' : 'tests passed'} (Cible: ≥ 95%)`}
            alert={getAlertForMetric('Pass Rate') || getAlertForMetric('Blocked Rate')}
            progress={{ value: d1.passRate, label: `${raw.passed} / ${raw.total}` }}
            delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
            comparisonPills={buildPills(t)}
            onExport={onExportCard ? (el) => onExportCard(el, useBusiness ? 'Taux de Succès' : 'Pass Rate') : null}
          />
        );
      }
      case 'failureRate': {
        const t = getTemporalForMetric?.('failureRate', d1.failureRate);
        return (
          <KPICard
            title={useBusiness ? "Taux d'Échec" : 'Failure Rate'}
            icon={<XCircle size={20} />}
            value={Math.round(d1.failureRate)}
            status={getKpiStatus('failureRate', d1.failureRate)}
            trend={getKpiTrend('failureRate', d1.failureRate)}
            subtitle={`${raw.failed} / ${raw.total} ${useBusiness ? 'tests échoués' : 'tests failed'} (Cible: ≤ 5%)`}
            alert={getAlertForMetric('Failure Rate')}
            progress={{ value: d1.failureRate, label: `${raw.failed} / ${raw.total}` }}
            delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
            invertDeltaColors
            comparisonPills={buildPills(t)}
            onExport={onExportCard ? (el) => onExportCard(el, useBusiness ? "Taux d'Échec" : 'Failure Rate') : null}
          />
        );
      }
      case 'testEfficiency': {
        const t = getTemporalForMetric?.('testEfficiency', d1.testEfficiency);
        return (
          <KPICard
            title={useBusiness ? 'Efficience des tests' : 'Test Efficiency'}
            icon={<TrendingUp size={20} />}
            value={Math.round(d1.testEfficiency)}
            status={getKpiStatus('testEfficiency', d1.testEfficiency)}
            trend={getKpiTrend('testEfficiency', d1.testEfficiency)}
            subtitle={`${raw.passed} / ${raw.passed + raw.failed} (Cible: ≥ 95%)`}
            alert={getAlertForMetric('Test Efficiency')}
            progress={{ value: d1.testEfficiency, label: `${raw.passed} / ${raw.passed + raw.failed}` }}
            delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
            comparisonPills={buildPills(t)}
            onExport={onExportCard ? (el) => onExportCard(el, useBusiness ? 'Efficience des tests' : 'Test Efficiency') : null}
          />
        );
      }
      default:
        return null;
    }
  };

  const doughnutRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="pp-section">
      <div className="pp-section-header">
        <h2 className="pp-section-title">{useBusiness ? 'PRÉPRODUCTION' : 'PREPROD'}</h2>
        <div className="pp-divider"></div>
      </div>

      {/* Grille principale Preprod */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="pp-kpi-grid">
            {widgetOrder.map((widgetId) => (
              <SortableKPI key={widgetId} id={widgetId} dragEnabled={dragEnabled}>
                {renderWidget(widgetId)}
              </SortableKPI>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Répartition des statuts */}
      <div className="pp-status-section" ref={doughnutRef}>
        <div className="pp-status-header">
          <BarChart3 size={24} />
          <span>{useBusiness ? 'Répartition Globale' : 'Global Distribution'}</span>
          {onExportDoughnut && (
            <button
              className="pp-status-export"
              onClick={() => doughnutRef.current && onExportDoughnut(doughnutRef.current)}
              type="button"
              title="Exporter ce graphique"
              aria-label="Exporter le graphique de répartition"
            >
              <Download size={14} />
            </button>
          )}
        </div>
        <div className="pp-status-chart">
          <div className="pp-doughnut-wrap">
            <Doughnut data={statusChartData} options={statusChartOptions} />
          </div>
        </div>
      </div>

      {/* Campagnes Actives */}
      <div className="pp-campaigns">
        <h3 className="pp-campaigns-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={24} color="var(--color-primary)" /> Campagnes Actives (Préproduction)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {setShowLatestOnly && (
              <div
                className="pp-toggle"
                onClick={() => setShowLatestOnly(!showLatestOnly)}
                role="switch"
                aria-checked={showLatestOnly}
                tabIndex={0}
              >
                <span
                  className="pp-toggle-label"
                  style={{
                    color: showLatestOnly ? 'var(--color-primary)' : 'var(--text-muted)',
                  }}
                >
                  {useBusiness ? 'Dernier actif' : 'Latest only'}
                </span>
                <div
                  className={`pp-toggle-track ${showLatestOnly ? 'pp-toggle-track--on' : ''}`}
                  style={{
                    backgroundColor: showLatestOnly ? 'var(--action-success-bg)' : 'var(--surface-muted)',
                    border: showLatestOnly ? '1px solid #059669' : '1px solid var(--border-color)',
                    boxShadow: showLatestOnly ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div className={`pp-toggle-knob ${showLatestOnly ? 'pp-toggle-knob--on' : 'pp-toggle-knob--off'}`}>
                    {showLatestOnly && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text-success)' }} />
                    )}
                  </div>
                </div>
              </div>
            )}
            <div
              className="pp-toggle"
              onClick={() => setShowAllRuns(!showAllRuns)}
              role="switch"
              aria-checked={showAllRuns}
              tabIndex={0}
            >
              <span
                className="pp-toggle-label"
                style={{
                  color: showAllRuns ? 'var(--color-primary)' : 'var(--text-muted)',
                }}
              >
                {useBusiness ? 'Tout afficher' : 'Show All'}
              </span>
              <div
                className={`pp-toggle-track ${showAllRuns ? 'pp-toggle-track--on' : ''}`}
                style={{
                  backgroundColor: showAllRuns ? 'var(--action-success-bg)' : 'var(--surface-muted)',
                  border: showAllRuns ? '1px solid #059669' : '1px solid var(--border-color)',
                  boxShadow: showAllRuns ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)',
                }}
              >
                <div className={`pp-toggle-knob ${showAllRuns ? 'pp-toggle-knob--on' : 'pp-toggle-knob--off'}`}>
                  {showAllRuns && (
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text-success)' }} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </h3>
        <div className="pp-campaigns-grid">
          {sortedRuns.slice(0, showAllRuns ? sortedRuns.length : sortedRuns.length <= 12 ? 12 : 8).map((run) => (
            <div
              key={run.id}
              title={
                run.isExploratory
                  ? `${useBusiness ? 'Session' : 'Session'} #${String(run.id).replace('session-', '')}: ${run.name}`
                  : run.name
              }
              className={`pp-campaign-card ${run.isExploratory ? 'pp-campaign-card--exploratory' : ''}`}
              style={{
                backgroundColor: run.isExploratory
                  ? isDark
                    ? 'rgba(139, 92, 246, 0.15)'
                    : 'rgba(139, 92, 246, 0.05)'
                  : 'var(--bg-color)',
                border: run.isExploratory
                  ? '1px solid var(--color-secondary)'
                  : '1px solid var(--border-color)',
                borderLeft: run.isExploratory ? '5px solid var(--color-secondary)' : '1px solid var(--border-color)',
                boxShadow: run.isExploratory ? '0 4px 12px rgba(139, 92, 246, 0.1)' : 'none',
              }}
              onMouseEnter={run.isExploratory ? (e) => { e.currentTarget.style.transform = 'scale(1.02)'; } : undefined}
              onMouseLeave={run.isExploratory ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
            >
              <div className="pp-campaign-header">
                <div className="pp-campaign-name">{run.name}</div>
                {run.isExploratory ? (
                  <div className="pp-campaign-badge">
                    <Search size={12} />
                    <span>{useBusiness ? 'Explo' : 'Explo'}</span>
                  </div>
                ) : (
                  <Database size={16} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                )}
              </div>

              {run.isExploratory && (
                <div
                  className="pp-campaign-status"
                  style={{ color: run.isClosed ? 'var(--text-muted)' : 'var(--text-success)' }}
                >
                  <div
                    className="pp-campaign-status-dot"
                    style={{ backgroundColor: run.isClosed ? 'var(--text-muted)' : 'var(--text-success)' }}
                  ></div>
                  {run.isClosed
                    ? useBusiness
                      ? 'Session terminée'
                      : 'Closed'
                    : useBusiness
                      ? 'Session en cours'
                      : 'Active'}
                </div>
              )}

              {(() => {
                const progressValue = run.total > 0 ? Math.round(((run.passed + run.failed + (run.skipped || 0)) / run.total) * 100) : 0;
                const progressColor = getProgressColor(progressValue);
                return (
                  <>
                    <div className="pp-campaign-metric" style={{ marginTop: run.isExploratory ? '0' : '0.4rem' }}>
                      <span className="pp-campaign-metric-label">{useBusiness ? 'Progression' : 'Progress'}</span>
                      <span className="pp-campaign-metric-value" style={{ color: progressColor }}>
                        {run.passed + run.failed + (run.skipped || 0)} / {run.total}
                      </span>
                    </div>
                    <div className="pp-progress-bar">
                      <div
                        className="pp-progress-fill"
                        style={{
                          width: `${progressValue}%`,
                          backgroundColor: progressColor,
                        }}
                      ></div>
                    </div>
                  </>
                );
              })()}

              <div className="pp-campaign-metric" style={{ marginTop: '0.4rem' }}>
                <span className="pp-campaign-metric-label">{useBusiness ? 'Taux de succès' : 'Pass Rate'}</span>
                <span className="pp-campaign-metric-value" style={{ color: getMetricColor('passRate', run.passRate) }}>{run.passRate}%</span>
              </div>
              <div className="pp-progress-bar">
                <div
                  className="pp-progress-fill"
                  style={{
                    width: `${run.passRate}%`,
                    backgroundColor: getMetricColor('passRate', run.passRate),
                  }}
                ></div>
              </div>
            </div>
          ))}
          {(originalRunsCount ?? sortedRuns.length) > 12 && !showAllRuns && !showLatestOnly && (
            <div className="pp-show-more">
              + {(originalRunsCount ?? sortedRuns.length) - 8} {useBusiness ? 'autres campagnes...' : 'other campaigns...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
