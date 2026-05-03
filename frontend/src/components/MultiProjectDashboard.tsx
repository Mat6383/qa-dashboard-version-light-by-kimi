import React from 'react';
import { useMultiProjectSummary } from '../hooks/queries';
import { BarChart3, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { getMetricColor } from '../lib/colors';
import '../styles/MultiProjectDashboard.css';

function getPassRateColor(value) {
  if (value === null) return '';
  return getMetricColor('passRate', value);
}

function getBlockedRateColor(value) {
  if (value === null) return '';
  return getMetricColor('blockedRate', value);
}

function getCompletionRateColor(value) {
  if (value === null) return '';
  return getMetricColor('completionRate', value);
}

export default function MultiProjectDashboard({ isDark: _isDark }) {
  const { data: summaries = [], isLoading, error, refetch } = useMultiProjectSummary();

  if (isLoading) {
    return (
      <div className="mpd-state">
        <Loader2 size={36} className="mpd-spinner" />
        <p>Chargement de la synthèse multi-projets…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mpd-state mpd-state-error">
        <AlertTriangle size={36} />
        <p>Erreur de chargement</p>
        <p className="mpd-state-desc">{error.message}</p>
        <button className="mpd-btn" onClick={() => refetch()}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="mpd-container">
      <div className="mpd-header">
        <BarChart3 size={22} />
        SYNTHÈSE MULTI-PROJETS
      </div>

      {summaries.length === 0 ? (
        <div className="mpd-state">
          <p>Aucun projet trouvé.</p>
        </div>
      ) : (
        <div className="mpd-table-wrapper">
          <table className="mpd-table">
            <thead>
              <tr>
                <th>Projet</th>
                <th>Pass Rate</th>
                <th>Completion</th>
                <th>Blocked</th>
                <th>Escape Rate</th>
                <th>Detection</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.projectId}>
                  <td className="mpd-project-name">{s.projectName}</td>
                  <td className="tabular-nums" style={{ color: getPassRateColor(s.passRate), fontWeight: 700 }}>
                    {s.passRate !== null ? `${s.passRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ color: getCompletionRateColor(s.completionRate), fontWeight: 700 }}>
                    {s.completionRate !== null ? `${s.completionRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ color: getBlockedRateColor(s.blockedRate), fontWeight: 700 }}>
                    {s.blockedRate !== null ? `${s.blockedRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="tabular-nums">{s.escapeRate !== null ? `${s.escapeRate.toFixed(1)}%` : '—'}</td>
                  <td className="tabular-nums">{s.detectionRate !== null ? `${s.detectionRate.toFixed(1)}%` : '—'}</td>
                  <td>
                    {s.slaStatus?.ok ? (
                      <span className="mpd-sla-ok">
                        <CheckCircle2 size={14} /> OK
                      </span>
                    ) : (
                      <span className="mpd-sla-ko">
                        <AlertTriangle size={14} /> {s.slaStatus?.alerts?.length || 0}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
