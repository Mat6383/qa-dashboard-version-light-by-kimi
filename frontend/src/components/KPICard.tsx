/**
 * ================================================
 * KPI CARD v2 — Carte de métrique premium
 * ================================================
 * Remplace MetricCard avec un design system cohérent :
 * - Hover élévation + transition 200ms
 * - Status visuel (bordure + icône + texte)
 * - Trend arrow + contexte comparatif
 * - Progress bar animée
 * - Accessibilité : role, aria-label, focus visible
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { MetricAlert, Trend } from '../types/api.types';

export type KpiStatus = 'ok' | 'warning' | 'critical' | 'info';
export type KpiTrend = 'up' | 'down' | 'neutral';

interface KPICardProps {
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
}: KPICardProps) {
  const cfg = statusConfig[status];
  const isClickable = !!onClick;

  return (
    <div
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
          </div>
        </div>

        {/* Value */}
        <div className="kpi-card__value-wrap">
          <span className="kpi-card__value" style={{ color: cfg.border }}>
            {value}
            <span className="kpi-card__unit">{unit}</span>
          </span>
          {trend && (
            <span className="kpi-card__trend" style={{ color: trendConfig[trend].color }}>
              {trendConfig[trend].icon}
              {trendValue && <span>{trendValue}</span>}
            </span>
          )}
        </div>

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

        {/* Alert */}
        {alert && (
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
