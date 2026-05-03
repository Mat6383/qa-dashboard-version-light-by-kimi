/**
 * ================================================
 * RUNS LIST COMPONENT
 * ================================================
 * Liste des runs de tests avec métriques
 * 
 * ISTQB: Test Execution Monitoring
 * LEAN: Vue rapide et actionnable
 * 
 * @author Matou - Neo-Logix QA Lead
 */

import React from 'react';
import { PlayCircle, CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react';
import '../styles/RunsList.css';

const RunsList = ({ metrics, useBusiness }) => {
  if (!metrics || !metrics.runs || metrics.runs.length === 0) {
    return (
      <div className="runs-empty">
        <PlayCircle size={48} color="#6B7280" />
        <p>Aucun run actif pour le moment</p>
      </div>
    );
  }

  return (
    <div className="runs-list-container">
      <div className="runs-header">
        <h3>
          <PlayCircle size={20} />
          {useBusiness ? 'Campagnes Actives' : 'Runs Actifs'} ({metrics.runsCount})
        </h3>
        <span className="runs-subtitle">{useBusiness ? 'ISTQB : Suivi d\'exécution' : 'ISTQB: Test Execution Monitoring'}</span>
      </div>

      <div className="runs-grid">
        {metrics.runs.map((run, index) => (
          <RunCard key={run.id} run={run} index={index} useBusiness={useBusiness} />
        ))}
      </div>
    </div>
  );
};

/**
 * Carte de run individuelle
 */
const RunCard = ({ run, index, useBusiness }) => {
  const statusColor = getStatusColor(run.passRate);
  const completionColor = getCompletionColor(run.completionRate);

  return (
    <div className="run-card" style={{ animationDelay: `${index * 0.1}s` }}>
      {/* Header */}
      <div className="run-card-header">
        <div className="run-info">
          <h4 className="run-name" style={{ color: 'var(--text-color)' }}>{run.name}</h4>
          <span className="run-id" style={{ color: 'var(--text-muted)' }}>ID: {run.id}</span>
        </div>
        <div
          className="run-status-badge"
          style={{ backgroundColor: statusColor }}
        >
          {run.passRate >= 95 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        </div>
      </div>

      {/* Métriques principales */}
      <div className="run-metrics">
        <div className="metric">
          <span className="metric-label">
            <Clock size={14} />
            {useBusiness ? 'Complétion' : 'Completion'}
          </span>
          <div className="metric-value">
            <span style={{ color: completionColor }}>{run.completionRate}%</span>
            <ProgressBar value={run.completionRate} color={completionColor} />
          </div>
        </div>

        <div className="metric">
          <span className="metric-label">
            <CheckCircle2 size={14} />
            {useBusiness ? 'Taux de succès' : 'Pass Rate'}
          </span>
          <div className="metric-value">
            <span style={{ color: statusColor }}>{run.passRate}%</span>
            <ProgressBar value={run.passRate} color={statusColor} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="run-card-footer">
        <span className="run-date">
          <Calendar size={12} />
          {formatDate(run.created_at)}
        </span>
        {run.milestone && (
          <span className="run-milestone">{useBusiness ? 'Jalon' : 'Milestone'}: {run.milestone}</span>
        )}
      </div>
    </div>
  );
};

/**
 * Barre de progression
 */
const ProgressBar = ({ value, color }) => {
  return (
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{
          width: `${value}%`,
          backgroundColor: color
        }}
      />
    </div>
  );
};

/**
 * Détermine la couleur selon le pass rate
 */
function getStatusColor(passRate) {
  if (passRate >= 95) return 'var(--text-success)';
  if (passRate >= 90) return 'var(--text-warning)';
  return 'var(--text-danger)';
}

/**
 * Détermine la couleur selon le completion rate
 */
function getCompletionColor(completionRate) {
  if (completionRate >= 90) return 'var(--text-success)';
  if (completionRate >= 80) return 'var(--text-warning)';
  return 'var(--text-danger)';
}

/**
 * Formate une date ISO en format lisible
 */
function formatDate(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `Il y a ${diffMins} min`;
  } else if (diffHours < 24) {
    return `Il y a ${diffHours}h`;
  } else if (diffDays < 7) {
    return `Il y a ${diffDays}j`;
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export default RunsList;
