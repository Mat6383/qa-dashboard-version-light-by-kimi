/**
 * ================================================
 * KPI CARD v2 — Carte de métrique premium
 * ================================================
 * Option C "Pro Suite" enhancements:
 * - Delta badge vs temporal comparison (▲+3.2%)
 * - Comparison pills (J-7 / J-14 / J-30)
 * - Per-card export button (PNG/PDF)
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 2.1.0
 */

import React, { useRef, useCallback } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { usePreferences } from '../hooks/usePreferences';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Download,
} from 'lucide-react';
import type { MetricAlert, KpiStatus, KpiTrend } from '../types/api.types';

export type { KpiStatus, KpiTrend };

export interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: KpiTrend;
  trendValue?: string;
  status?: KpiStatus;
  alert?: MetricAlert | null;
  progress?: { value: number; label: string } | null;
  icon?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  // Option C — Temporal comparison
  delta?: {
    value: number;
    label: string;
  } | null;
  invertDeltaColors?: boolean;
  comparisonPills?: Array<{ label: string; value: string }> | null;
  // Option C — Per-card export
  onExport?: ((element: HTMLElement) => void) | null;
}

const statusConfig: Record<KpiStatus, { border: string; bg: string; icon: React.ReactNode; label: string }> = {
  ok: {
    border: 'var(--status-success)',
    bg: 'var(--status-success-bg)',
    icon: <CheckCircle2 size={16} />,
    label: 'OK',
  },
  warning: {
    border: 'var(--status-warning)',
    bg: 'var(--status-warning-bg)',
    icon: <AlertTriangle size={16} />,
    label: 'Attention',
  },
  critical: {
    border: 'var(--status-danger)',
    bg: 'var(--status-danger-bg)',
    icon: <AlertCircle size={16} />,
    label: 'Critique',
  },
  info: {
    border: 'var(--status-info)',
    bg: 'var(--status-info-bg)',
    icon: <CheckCircle2 size={16} />,
    label: 'Info',
  },
};

const trendConfig: Record<KpiTrend, { icon: React.ReactNode; color: string }> = {
  up: { icon: <TrendingUp size={14} />, color: 'var(--text-success)' },
  down: { icon: <TrendingDown size={14} />, color: 'var(--text-danger)' },
  neutral: { icon: <Minus size={14} />, color: 'var(--text-muted)' },
};

function getDeltaColor(deltaValue: number, invert: boolean): string {
  if (invert) {
    return deltaValue > 0 ? 'var(--text-danger)' : deltaValue < 0 ? 'var(--text-success)' : 'var(--text-muted)';
  }
  return deltaValue > 0 ? 'var(--text-success)' : deltaValue < 0 ? 'var(--text-danger)' : 'var(--text-muted)';
}

function getDeltaBg(deltaValue: number, invert: boolean): string {
  if (invert) {
    return deltaValue > 0 ? 'rgba(239,68,68,0.12)' : deltaValue < 0 ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)';
  }
  return deltaValue > 0 ? 'rgba(34,197,94,0.12)' : deltaValue < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.1)';
}

/* ── Animated Value sub-component ─────────────────────────────── */

interface KPIValueProps {
  value: string | number;
  unit: string;
  color: string;
  trend?: KpiTrend;
  trendValue?: string;
}

function KPIValue({ value, unit, color, trend, trendValue }: KPIValueProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
  const isNumeric = !isNaN(numericValue);
  const animated = useAnimatedNumber(isNumeric ? numericValue : 0, { enabled: isNumeric });

  return (
    <div className="kpi-card__value-wrap">
      <span className="kpi-card__value" style={{ color }}>
        {isNumeric ? animated : value}
        <span className="kpi-card__unit">{unit}</span>
      </span>
      {trend && (
        <span className="kpi-card__trend" style={{ color: trendConfig[trend].color }}>
          {trendConfig[trend].icon}
          {trendValue && <span>{trendValue}</span>}
        </span>
      )}
    </div>
  );
}

/* ── Main KPICard component ───────────────────────────────────── */

export default function KPICard({
  title,
  value,
  unit = '%',
  subtitle,
  trend,
  trendValue,
  status = 'info',
  alert,
  progress,
  icon,
  onClick,
  children,
  className = '',
  delta,
  invertDeltaColors = false,
  comparisonPills,
  onExport,
}: KPICardProps) {
  const { showCriticalAlerts } = usePreferences();
  const cfg = statusConfig[status];
  const isClickable = !!onClick;
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (cardRef.current && onExport) {
        onExport(cardRef.current);
      }
    },
    [onExport]
  );

  return (
    <div
      ref={cardRef}
      className={`kpi-card ${isClickable ? 'kpi-card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `${title}: ${value}${unit}. Cliquer pour voir le détail.` : undefined}
    >
      {/* Bordure latérale de status */}
      <div className="kpi-card__accent" style={{ backgroundColor: cfg.border }} />

      <div className="kpi-card__content">
        {/* Header */}
        <div className="kpi-card__header">
          <div className="kpi-card__title-wrap">
            {icon && <span className="kpi-card__icon">{icon}</span>}
            <span className="kpi-card__title">{title}</span>
          </div>
          <div className="kpi-card__badges">
            <span
              className="kpi-card__status-badge"
              style={{
                backgroundColor: cfg.bg,
                color: cfg.border,
                border: `1px solid ${cfg.border}`,
              }}
            >
              {cfg.icon}
              <span>{cfg.label}</span>
            </span>
            {onExport && (
              <button
                className="kpi-card__export-btn"
                onClick={handleExport}
                type="button"
                title="Exporter cette carte"
                aria-label={`Exporter ${title}`}
              >
                <Download size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Value */}
        <KPIValue value={value} unit={unit} color={cfg.border} trend={trend} trendValue={trendValue} />

        {/* Delta badge */}
        {delta && (
          <div className="kpi-card__delta">
            <span
              className="kpi-card__delta-badge"
              style={{
                backgroundColor: getDeltaBg(delta.value, invertDeltaColors),
                color: getDeltaColor(delta.value, invertDeltaColors),
              }}
            >
              {delta.value > 0 ? '▲' : delta.value < 0 ? '▼' : '•'} {delta.value > 0 ? '+' : ''}
              {delta.value}% {delta.label}
            </span>
          </div>
        )}

        {/* Subtitle */}
        {subtitle && <p className="kpi-card__subtitle">{subtitle}</p>}

        {/* Progress */}
        {progress && (
          <div className="kpi-card__progress">
            <div className="kpi-card__progress-header">
              <span>{progress.label}</span>
              <span>{Math.round(progress.value)}%</span>
            </div>
            <div className="kpi-card__progress-track">
              <div
                className="kpi-card__progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, progress.value))}%`,
                  backgroundColor: cfg.border,
                }}
              />
            </div>
          </div>
        )}

        {/* Comparison pills */}
        {comparisonPills && comparisonPills.length > 0 && (
          <div className="kpi-card__pills">
            {comparisonPills.map((pill) => (
              <span key={pill.label} className="kpi-card__pill">
                {pill.label}: {pill.value}
              </span>
            ))}
          </div>
        )}

        {/* Alert */}
        {alert && showCriticalAlerts && (
          <div
            className="kpi-card__alert"
            style={{
              backgroundColor: cfg.bg,
              border: `1px solid ${cfg.border}`,
              color: cfg.border,
            }}
          >
            {cfg.icon}
            <span>{alert.message}</span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
