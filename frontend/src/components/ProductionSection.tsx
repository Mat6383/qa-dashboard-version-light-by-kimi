/**
 * ================================================
 * PRODUCTION SECTION — Dashboard4 Production v2
 * ================================================
 * Escape Rate + Detection Rate (DDP) avec KPICards premium.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 2.0.0
 */

import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import KPICard from './KPICard';
import { getMetricColor, getMetricLevel } from '../lib/colors';
import type { AnomalyItem, QualityRates, KpiStatus, KpiTrend } from '../types/api.types';
import '../styles/ProductionSection.css';

interface ProductionRates extends QualityRates {
  prodMilestone: string;
  bugsInProd: number;
  bugsInTest: number;
}

interface ProductionSectionProps {
  rates: ProductionRates | null;
  escapeOk: boolean;
  ddpOk: boolean;
  showProductionSection: boolean;
  onToggleProductionSection?: (show: boolean) => void;
  isDark: boolean;
  useBusiness: boolean;
  anomalies: AnomalyItem[];
}

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

function getTrend(anomalies: AnomalyItem[], metricKey: string): import('../types/api.types').MetricAlert | null {
  const a = anomalies?.find((a) => a.metric === metricKey);
  if (!a) return null;
  return {
    severity: a.severity === 'high' ? 'critical' : a.severity,
    message: `Anomalie ${a.metric} (z-score: ${a.zScore.toFixed(2)})`,
  };
}

export default function ProductionSection({
  rates,
  escapeOk: _escapeOk,
  ddpOk: _ddpOk,
  showProductionSection,
  onToggleProductionSection,
  isDark,
  useBusiness,
  anomalies,
}: ProductionSectionProps) {
  if (!rates) return null;

  const milestoneDisplay = rates.prodMilestone && rates.prodMilestone !== 'N/A' ? rates.prodMilestone : '—';

  return (
    <div className="prod-section">
      <div className="prod-header">
        <h2>{useBusiness ? 'PRODUCTION' : 'PRODUCTION'}</h2>
        {onToggleProductionSection && (
          <div
            className="prod-toggle"
            onClick={() => onToggleProductionSection(!showProductionSection)}
            role="switch"
            aria-checked={showProductionSection}
            tabIndex={0}
          >
            <span className={`prod-toggle-label ${showProductionSection ? 'prod-toggle-label--active' : 'prod-toggle-label--inactive'}`}>
              {showProductionSection ? 'Visible' : 'Masqué'}
            </span>
            <div className={`prod-toggle-track ${showProductionSection ? 'prod-toggle-track--active' : 'prod-toggle-track--inactive'}`}>
              <div className={`prod-toggle-thumb ${showProductionSection ? 'prod-toggle-thumb--active' : 'prod-toggle-thumb--inactive'}`} />
            </div>
          </div>
        )}
        <div className="prod-header-line"></div>
      </div>

      {showProductionSection && (
        <div className="prod-kpi-grid">
          <KPICard
            title={useBusiness ? "Taux d'Échappement" : 'Escape Rate'}
            icon={<ShieldAlert size={20} />}
            value={Math.round(rates.escapeRate)}
            status={getKpiStatus('escapeRate', rates.escapeRate)}
            trend={getKpiTrend('escapeRate', rates.escapeRate)}
            subtitle={`${useBusiness ? 'Jalon' : 'Milestone'}: ${milestoneDisplay} • Objectif: < 5%`}
            alert={getTrend(anomalies, 'escape_rate')}
          />
          <KPICard
            title={useBusiness ? 'Taux de Détection' : 'Detection Rate'}
            icon={<ShieldCheck size={20} />}
            value={Math.round(rates.detectionRate)}
            status={getKpiStatus('detectionRate', rates.detectionRate)}
            trend={getKpiTrend('detectionRate', rates.detectionRate)}
            subtitle={`${useBusiness ? 'Lié' : 'Linked'}: ${milestoneDisplay} • Objectif: > 95%`}
            alert={getTrend(anomalies, 'detection_rate')}
          />
        </div>
      )}
    </div>
  );
}
