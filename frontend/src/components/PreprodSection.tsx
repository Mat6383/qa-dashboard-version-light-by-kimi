/**
 * ================================================
 * PREPROD SECTION — Dashboard4 Préproduction v2
 * ================================================
 * Grille de KPIs premium, répartition Doughnut, campagnes actives.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 2.0.0
 */

import React, { useMemo } from 'react';
import { Activity, CheckSquare, XCircle, TrendingUp, BarChart3, Database, Search } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import KPICard from './KPICard';
import { getMetricColor, getMetricLevel } from '../lib/colors';
import type { DashboardMetrics, RawMetrics, Run, MetricAlert, KpiStatus, KpiTrend } from '../types/api.types';
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

interface PreprodSectionProps {
  metrics: DashboardMetrics;
  raw: RawMetrics;
  sortedRuns: Run[];
  showAllRuns: boolean;
  setShowAllRuns: (show: boolean) => void;
  isDark: boolean;
  useBusiness: boolean;
  getAlertForMetric: (metric: string) => MetricAlert | undefined;
  anomalies: import('../types/api.types').AnomalyItem[];
}

export default function PreprodSection({
  metrics,
  raw,
  sortedRuns,
  showAllRuns,
  setShowAllRuns,
  isDark,
  useBusiness,
  getAlertForMetric,
  anomalies,
}: PreprodSectionProps) {
  const d1 = metrics;

  const statusChartData = useMemo(() => {
    const labels = [
      useBusiness ? 'Réussis' : 'Passed',
      useBusiness ? 'Échoués' : 'Failed',
      useBusiness ? 'En cours' : 'WIP',
      useBusiness ? 'Bloqués' : 'Blocked',
      useBusiness ? 'Non testés' : 'Untested',
    ];
    const data = [raw.passed, raw.failed, raw.wip, raw.blocked, raw.untested];
    const colors = [
      'var(--status-success)',
      'var(--status-danger)',
      'var(--status-info)',
      'var(--status-warning)',
      'var(--text-muted)',
    ];
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: 'var(--surface-elevated)',
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    };
  }, [raw, useBusiness]);

  const statusChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: 'var(--text-secondary)',
          font: { size: 12, weight: 'bold' as const },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'var(--surface-elevated)',
        titleColor: 'var(--text-default)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border-color)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw}`,
        },
      },
    },
  }), []);

  return (
    <div className="pp-section">
      <div className="pp-section-header">
        <h2 className="pp-section-title">
          {useBusiness ? 'PRÉPRODUCTION' : 'PREPROD'}
        </h2>
        <div className="pp-divider"></div>
      </div>

      {/* Grille principale Preprod */}
      <div className="pp-kpi-grid">
        <KPICard
          title={useBusiness ? "Taux d'Exécution" : 'Execution Rate'}
          icon={<Activity size={20} />}
          value={Math.round(d1.completionRate)}
          status={getKpiStatus('completionRate', d1.completionRate)}
          trend={getKpiTrend('completionRate', d1.completionRate)}
          subtitle={`${raw.completed} / ${raw.total} ${useBusiness ? 'tests exécutés' : 'tests executed'} (Cible: ≥ 90%)`}
          alert={getAlertForMetric('Completion Rate')}
          progress={{ value: d1.completionRate, label: `${raw.completed} / ${raw.total}` }}
        />
        <KPICard
          title={useBusiness ? 'Taux de Succès' : 'Pass Rate'}
          icon={<CheckSquare size={20} />}
          value={Math.round(d1.passRate)}
          status={getKpiStatus('passRate', d1.passRate)}
          trend={getKpiTrend('passRate', d1.passRate)}
          subtitle={`${raw.passed} / ${raw.total} ${useBusiness ? 'tests réussis' : 'tests passed'} (Cible: ≥ 95%)`}
          alert={getAlertForMetric('Pass Rate') || getAlertForMetric('Blocked Rate')}
          progress={{ value: d1.passRate, label: `${raw.passed} / ${raw.total}` }}
        />
        <KPICard
          title={useBusiness ? "Taux d'Échec" : 'Failure Rate'}
          icon={<XCircle size={20} />}
          value={Math.round(d1.failureRate)}
          status={getKpiStatus('failureRate', d1.failureRate)}
          trend={getKpiTrend('failureRate', d1.failureRate)}
          subtitle={`${raw.failed} / ${raw.total} ${useBusiness ? 'tests échoués' : 'tests failed'} (Cible: ≤ 5%)`}
          alert={getAlertForMetric('Failure Rate')}
          progress={{ value: d1.failureRate, label: `${raw.failed} / ${raw.total}` }}
        />
        <KPICard
          title={useBusiness ? 'Efficience des tests' : 'Test Efficiency'}
          icon={<TrendingUp size={20} />}
          value={Math.round(d1.testEfficiency)}
          status={getKpiStatus('testEfficiency', d1.testEfficiency)}
          trend={getKpiTrend('testEfficiency', d1.testEfficiency)}
          subtitle={`${raw.passed} / ${raw.passed + raw.failed} (Cible: ≥ 95%)`}
          alert={getAlertForMetric('Test Efficiency')}
          progress={{ value: d1.testEfficiency, label: `${raw.passed} / ${raw.passed + raw.failed}` }}
        />
      </div>

      {/* Répartition des statuts */}
      <div className="pp-status-section">
        <div className="pp-status-header">
          <BarChart3 size={24} />
          <span>{useBusiness ? 'Répartition Globale' : 'Global Distribution'}</span>
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
                <div className="pp-campaign-name">
                  {run.name}
                </div>
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
          {sortedRuns.length > 12 && !showAllRuns && (
            <div className="pp-show-more">
              + {sortedRuns.length - 8} {useBusiness ? 'autres campagnes...' : 'other campaigns...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
