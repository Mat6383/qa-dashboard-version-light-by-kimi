/**
 * ================================================
 * PRODUCTION SECTION — Dashboard4 Production
 * ================================================
 * Escape Rate + Detection Rate (DDP) avec toggle visibilité.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import TrendBadge from './TrendBadge';
import { getMetricColor, getMetricLevel } from '../lib/colors';
import type { AnomalyItem, QualityRates } from '../types/api.types';
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

function getTrend(anomalies: AnomalyItem[], metricKey: string) {
  return anomalies?.find((a) => a.metric === metricKey) || null;
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

  const escapeLevel = getMetricLevel('escapeRate', rates.escapeRate);
  const ddpLevel = getMetricLevel('detectionRate', rates.detectionRate);
  const escapeColor = getMetricColor('escapeRate', rates.escapeRate);
  const ddpColor = getMetricColor('detectionRate', rates.detectionRate);

  return (
    <div className="prod-section">
      <div className="prod-header">
        <h2>
          {useBusiness ? 'PRODUCTION' : 'PRODUCTION'}
        </h2>
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
        <>
          <div className="prod-grid">
            {/* Escape Rate */}
            <div className="prod-card" style={{ borderColor: escapeColor }}>
              <div className="prod-card-content">
                <h3 className="prod-card-title">
                  <ShieldAlert size={24} color={escapeColor} /> Taux d&apos;Échappement
                  <TrendBadge trend={getTrend(anomalies, 'escape_rate')} style={{ marginLeft: '8px' }} />
                </h3>
                <div className="prod-card-meta">
                  <span>
                    {useBusiness ? 'Jalon' : 'Milestone'}:{' '}
                    <strong style={{ color: 'var(--text-color)' }}>{rates.prodMilestone}</strong>
                  </span>
                  <span>
                    {useBusiness ? 'Objectif' : 'Target'}:{' '}
                    <strong style={{ color: escapeColor }}>&lt; 5%</strong>
                  </span>
                </div>
              </div>
              <div className="prod-card-value-wrap">
                <div className="prod-card-value" style={{ color: escapeColor }}>
                  {rates.escapeRate}%
                </div>
                <div className="prod-card-badge">
                  {rates.bugsInProd} {useBusiness ? 'bugs prod' : 'prod bugs'}
                </div>
              </div>
            </div>

            {/* Detection Rate (DDP) */}
            <div className="prod-card" style={{ borderColor: ddpColor }}>
              <div className="prod-card-content">
                <h3 className="prod-card-title">
                  <ShieldCheck size={24} color={ddpColor} /> Taux de Détection
                  <TrendBadge trend={getTrend(anomalies, 'detection_rate')} style={{ marginLeft: '8px' }} />
                </h3>
                <div className="prod-card-meta">
                  <span>
                    {useBusiness ? 'Lié' : 'Linked'}:{' '}
                    <strong style={{ color: 'var(--text-color)' }}>{rates.prodMilestone}</strong>
                  </span>
                  <span>
                    {useBusiness ? 'Objectif' : 'Target'}:{' '}
                    <strong style={{ color: ddpColor }}>&gt; 95%</strong>
                  </span>
                </div>
              </div>
              <div className="prod-card-value-wrap">
                <div className="prod-card-value" style={{ color: ddpColor }}>
                  {rates.detectionRate}%
                </div>
                <div className="prod-card-badge">
                  {rates.bugsInTest} {useBusiness ? 'bugs test' : 'test bugs'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
