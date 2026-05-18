import React, { useMemo } from 'react';
import { Database, Search } from 'lucide-react';
import { getMetricColor } from '../../lib/colors';
import { getProgressColor } from '../../lib/kpiHelpers';
import type { Run } from '../../types/api.types';

interface CampaignCardProps {
  run: Run;
  useBusiness: boolean;
  isDark: boolean;
}

export default function CampaignCard({ run, useBusiness, isDark }: CampaignCardProps) {
  const progressValue = useMemo(
    () => (run.total > 0 ? Math.round(((run.passed + run.failed + (run.skipped || 0)) / run.total) * 100) : 0),
    [run]
  );
  const progressColor = getProgressColor(progressValue);

  const cardStyle: React.CSSProperties = {
    backgroundColor: run.isExploratory
      ? isDark
        ? 'rgba(139, 92, 246, 0.15)'
        : 'rgba(139, 92, 246, 0.05)'
      : 'var(--bg-color)',
    border: run.isExploratory ? '1px solid var(--color-secondary)' : '1px solid var(--border-color)',
    borderLeft: run.isExploratory ? '5px solid var(--color-secondary)' : '1px solid var(--border-color)',
    boxShadow: run.isExploratory ? '0 4px 12px rgba(139, 92, 246, 0.1)' : 'none',
  };

  return (
    <div
      key={run.id}
      title={
        run.isExploratory
          ? `${useBusiness ? 'Session' : 'Session'} #${String(run.id).replace('session-', '')}: ${run.name}`
          : run.name
      }
      className={`pp-campaign-card ${run.isExploratory ? 'pp-campaign-card--exploratory' : ''}`}
      style={cardStyle}
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
        <div className="pp-campaign-status" style={{ color: run.isClosed ? 'var(--text-muted)' : 'var(--text-success)' }}>
          <div
            className="pp-campaign-status-dot"
            style={{ backgroundColor: run.isClosed ? 'var(--text-muted)' : 'var(--text-success)' }}
          />
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
        <span className="pp-campaign-metric-label">{useBusiness ? 'Progression' : 'Progress'}</span>
        <span className="pp-campaign-metric-value" style={{ color: progressColor }}>
          {run.passed + run.failed + (run.skipped || 0)} / {run.total}
        </span>
      </div>
      <div className="pp-progress-bar">
        <div className="pp-progress-fill" style={{ width: `${progressValue}%`, backgroundColor: progressColor }} />
      </div>

      <div className="pp-campaign-metric" style={{ marginTop: '0.4rem' }}>
        <span className="pp-campaign-metric-label">{useBusiness ? 'Taux de succès' : 'Pass Rate'}</span>
        <span className="pp-campaign-metric-value" style={{ color: getMetricColor('passRate', run.passRate) }}>
          {run.passRate}%
        </span>
      </div>
      <div className="pp-progress-bar">
        <div
          className="pp-progress-fill"
          style={{
            width: `${run.passRate}%`,
            backgroundColor: getMetricColor('passRate', run.passRate),
          }}
        />
      </div>
    </div>
  );
}
