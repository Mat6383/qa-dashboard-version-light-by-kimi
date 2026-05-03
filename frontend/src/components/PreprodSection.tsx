/**
 * ================================================
 * PREPROD SECTION — Dashboard4 Préproduction
 * ================================================
 * Grille de métriques, répartition des statuts, campagnes actives.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React from 'react';
import { Activity, CheckSquare, XCircle, TrendingUp, BarChart3, Database, Search } from 'lucide-react';
import MetricCard from './MetricCard';
import { getMetricColor } from '../lib/colors';
import type { DashboardMetrics, RawMetrics, Run, AnomalyItem, MetricAlert } from '../types/api.types';
import '../styles/PreprodSection.css';

export function getPassRateColor(passRate: number): string {
  return getMetricColor('passRate', passRate);
}

function getTrend(anomalies: AnomalyItem[], metricKey: string) {
  return anomalies?.find((a) => a.metric === metricKey) || null;
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
  anomalies: AnomalyItem[];
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

  return (
    <div className="pp-section">
      <div className="pp-section-header">
        <h2 className="pp-section-title">
          {useBusiness ? 'PRÉPRODUCTION' : 'PREPROD'}
        </h2>
        <div className="pp-divider"></div>
      </div>

      {/* Grille principale Preprod */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem',
      }}>
        <MetricCard
          title={useBusiness ? "Taux d'Exécution" : 'Execution Rate'}
          icon={Activity}
          value={d1.completionRate}
          color={getMetricColor('completionRate', d1.completionRate)}
          arrow={d1.completionRate >= 90 ? '▲' : '▼'}
          badge={`${raw.completed} / ${raw.total}`}
          label={useBusiness ? 'tests exécutés (Cible: ≥ 90%)' : 'tests executed (Target: ≥ 90%)'}
          alert={getAlertForMetric('Completion Rate')}
          useBusiness={useBusiness}
          trend={getTrend(anomalies, 'completion_rate')}
        />
        <MetricCard
          title={useBusiness ? 'Taux de Succès' : 'Pass Rate'}
          icon={CheckSquare}
          value={d1.passRate}
          color={getMetricColor('passRate', d1.passRate)}
          arrow={d1.passRate >= 95 ? '▲' : '▼'}
          badge={raw.passed}
          label={useBusiness ? 'tests réussis (Cible: ≥ 95%)' : 'tests passed (Target: ≥ 95%)'}
          description={
            useBusiness
              ? '(Réussis / Total des tests terminés, bloqués ou ignorés)'
              : '(Passed / Total completed, blocked or skipped)'
          }
          alert={getAlertForMetric('Pass Rate') || getAlertForMetric('Blocked Rate')}
          useBusiness={useBusiness}
          trend={getTrend(anomalies, 'pass_rate')}
        />
        <MetricCard
          title={useBusiness ? "Taux d'Échec" : 'Failure Rate'}
          icon={XCircle}
          value={d1.failureRate}
          color={getMetricColor('failureRate', d1.failureRate)}
          arrow={d1.failureRate <= 5 ? '▼' : '▲'}
          badge={raw.failed}
          label={useBusiness ? 'tests échoués (Cible: ≤ 5%)' : 'tests failed (Target: ≤ 5%)'}
          alert={getAlertForMetric('Failure Rate')}
          useBusiness={useBusiness}
        />
        <MetricCard
          title={useBusiness ? 'Efficience des tests' : 'Test Efficiency'}
          icon={TrendingUp}
          value={d1.testEfficiency}
          color={getMetricColor('testEfficiency', d1.testEfficiency)}
          arrow={d1.testEfficiency >= 95 ? '▲' : '▼'}
          badge={useBusiness ? 'Objectif' : 'Target'}
          label={useBusiness ? 'Approcher les 100% (≥ 95%)' : 'Approach 100% (≥ 95%)'}
          description={useBusiness ? '(Réussis / (Réussis + Échoués) purs)' : '(Passed / (Passed + Failed))'}
          alert={getAlertForMetric('Test Efficiency')}
          useBusiness={useBusiness}
        />
      </div>

      {/* Répartition des statuts */}
      <div className="pp-status-bar">
        <div className="pp-status-title">
          <BarChart3 size={24} /> Répartition Globale
        </div>
        {[
          { label: useBusiness ? 'Réussis' : 'Passed', val: raw.passed, color: 'var(--text-success)' },
          { label: useBusiness ? 'Échoués' : 'Failed', val: raw.failed, color: 'var(--text-danger)' },
          { label: useBusiness ? 'En cours' : 'WIP', val: raw.wip, color: 'var(--text-primary)' },
          { label: useBusiness ? 'Bloqués' : 'Blocked', val: raw.blocked, color: 'var(--text-warning)' },
          { label: useBusiness ? 'Non testés' : 'Untested', val: raw.untested, color: 'var(--text-muted)' },
        ].map((stat) => (
          <div key={stat.label} className="pp-status-item">
            <div className="pp-status-dot" style={{ backgroundColor: stat.color }}></div>
            <span className="pp-status-label">{stat.label}:</span>
            <span className="pp-status-value">{stat.val}</span>
          </div>
        ))}
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

              <div className="pp-campaign-metric" style={{ marginTop: run.isExploratory ? '0' : '0.4rem' }}>
                <span className="pp-campaign-metric-label">{useBusiness ? 'Taux de succès' : 'Pass Rate'}</span>
                <span className="pp-campaign-metric-value" style={{ color: getPassRateColor(run.passRate) }}>{run.passRate}%</span>
              </div>
              <div className="pp-progress-bar">
                <div
                  className="pp-progress-fill"
                  style={{
                    width: `${run.passRate}%`,
                    backgroundColor: getPassRateColor(run.passRate),
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
