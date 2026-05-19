import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, AlertCircle, CheckCircle2, X, TrendingDown, BarChart3, ShieldAlert, Zap } from 'lucide-react';
import type { DashboardMetrics, AnomalyItem, ReadinessResult } from '../types/api.types';

interface SmartAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  message: string;
  recommendation: string;
}

interface SmartAlertsProps {
  metrics?: DashboardMetrics | null;
  anomalies?: AnomalyItem[];
  readiness?: ReadinessResult | null;
  onDismiss?: (id: string) => void;
  dismissed?: string[];
}

function generateSmartAlerts(
  metrics: DashboardMetrics | null | undefined,
  anomalies: AnomalyItem[] | undefined,
  readiness: ReadinessResult | null | undefined
): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  if (!metrics) return alerts;

  const raw = metrics.raw || {};
  const passRate = metrics.passRate ?? 0;
  const completionRate = metrics.completionRate ?? 0;
  const blockedRate = metrics.blockedRate ?? 0;
  const failureRate = metrics.failureRate ?? 0;

  // Critical: Pass rate dropped below 85%
  if (passRate < 85) {
    alerts.push({
      id: 'pass-rate-critical',
      severity: 'critical',
      icon: <TrendingDown size={16} />,
      title: 'Pass Rate Critique',
      message: `Le taux de succès est à ${passRate}% (cible: ≥ 95%)`,
      recommendation: 'Investiguer les tests échoués récents. Vérifier si un bug a été introduit dans le dernier build.',
    });
  } else if (passRate < 90) {
    alerts.push({
      id: 'pass-rate-warning',
      severity: 'warning',
      icon: <BarChart3 size={16} />,
      title: 'Pass Rate Faible',
      message: `Le taux de succès est à ${passRate}% (cible: ≥ 95%)`,
      recommendation: 'Réviser les cas de test instables (flaky). Vérifier les environnements de test.',
    });
  }

  // Critical: Completion rate too low
  if (completionRate < 70) {
    alerts.push({
      id: 'completion-critical',
      severity: 'critical',
      icon: <AlertCircle size={16} />,
      title: 'Avancement Très Faible',
      message: `Seulement ${completionRate}% des tests sont exécutés`,
      recommendation: 'Allouer plus de ressources QA ou réduire la scope de la release.',
    });
  } else if (completionRate < 85) {
    alerts.push({
      id: 'completion-warning',
      severity: 'warning',
      icon: <AlertTriangle size={16} />,
      title: 'Avancement en Retard',
      message: `${completionRate}% de completion (cible: ≥ 90%)`,
      recommendation: 'Accélérer l\'exécution des tests. Identifier les blocages.',
    });
  }

  // Warning: High blocked rate
  if (blockedRate > 5) {
    alerts.push({
      id: 'blocked-high',
      severity: 'warning',
      icon: <ShieldAlert size={16} />,
      title: 'Taux de Blocage Élevé',
      message: `${blockedRate}% des tests sont bloqués`,
      recommendation: 'Débloquer les tests bloqués en priorité. Souvent lié à des dépendances externes.',
    });
  }

  // Warning: High failure rate
  if (failureRate > 10) {
    alerts.push({
      id: 'failure-high',
      severity: 'critical',
      icon: <Zap size={16} />,
      title: 'Taux d\'Échec Critique',
      message: `${failureRate}% des tests échouent`,
      recommendation: 'Arrêter les nouveaux développements et focus sur la stabilisation. Analyser les régressions.',
    });
  }

  // Anomalies
  (anomalies || []).forEach((a, idx) => {
    if (a.severity === 'high') {
      alerts.push({
        id: `anomaly-${idx}`,
        severity: 'critical',
        icon: <AlertCircle size={16} />,
        title: `Anomalie détectée: ${a.metric}`,
        message: `Valeur: ${a.value} (z-score: ${a.zScore})`,
        recommendation: 'Investigation immédiate recommandée. Comparer avec les exécutions précédentes.',
      });
    } else {
      alerts.push({
        id: `anomaly-${idx}`,
        severity: 'warning',
        icon: <AlertTriangle size={16} />,
        title: `Anomalie: ${a.metric}`,
        message: `Valeur: ${a.value} (z-score: ${a.zScore})`,
        recommendation: 'Surveiller la tendance sur les prochains runs.',
      });
    }
  });

  // Readiness blocked
  if (readiness && readiness.status === 'blocked') {
    alerts.push({
      id: 'readiness-blocked',
      severity: 'critical',
      icon: <AlertCircle size={16} />,
      title: 'Release Bloquée',
      message: `Score de maturité: ${readiness.score}/100`,
      recommendation: 'Résoudre les facteurs bloquants avant de considérer la release.',
    });
  } else if (readiness && readiness.status === 'caution') {
    alerts.push({
      id: 'readiness-caution',
      severity: 'warning',
      icon: <AlertTriangle size={16} />,
      title: 'Release en Caution',
      message: `Score de maturité: ${readiness.score}/100`,
      recommendation: 'Revue managériale recommandée avant release.',
    });
  }

  return alerts;
}

const severityConfig = {
  critical: { border: 'var(--status-danger-border)', bg: 'var(--status-danger-bg)', icon: <AlertCircle size={18} /> },
  warning: { border: 'var(--status-warning-border)', bg: 'var(--status-warning-bg)', icon: <AlertTriangle size={18} /> },
  info: { border: 'var(--status-info-border)', bg: 'var(--status-info-bg)', icon: <CheckCircle2 size={18} /> },
};

export default function SmartAlerts({ metrics, anomalies, readiness, onDismiss, dismissed = [] }: SmartAlertsProps) {
  const { t } = useTranslation();
  const alerts = useMemo(() => generateSmartAlerts(metrics, anomalies, readiness), [metrics, anomalies, readiness]);
  const visibleAlerts = alerts.filter((a) => !dismissed.includes(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="smart-alerts">
      {visibleAlerts.map((alert) => {
        const cfg = severityConfig[alert.severity];
        return (
          <div
            key={alert.id}
            className={`smart-alert smart-alert--${alert.severity}`}
            style={{
              backgroundColor: cfg.bg,
              border: `1px solid ${cfg.border}`,
            }}
          >
            <div className="smart-alert__icon">{cfg.icon}</div>
            <div className="smart-alert__content">
              <div className="smart-alert__header">
                <span className="smart-alert__title">{alert.title}</span>
                {onDismiss && (
                  <button
                    className="smart-alert__dismiss"
                    onClick={() => onDismiss(alert.id)}
                    aria-label="Dismiss alert"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="smart-alert__message">{alert.message}</p>
              <p className="smart-alert__recommendation">
                <strong>{t('alerts.recommendation')}:</strong> {alert.recommendation}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
