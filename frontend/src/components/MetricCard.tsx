/**
 * ================================================
 * METRIC CARD — Carte de métrique réutilisable
 * ================================================
 * Utilisée par Dashboard4 (vue globale) pour afficher
 * completionRate, passRate, failureRate, testEfficiency.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React from 'react';
import type { MetricAlert, Trend } from '../types/api.types';
import TrendBadge from './TrendBadge';

interface AlertItemProps {
  alert: MetricAlert | null | undefined;
  useBusiness?: boolean;
}

function AlertItem({ alert, useBusiness }: AlertItemProps) {
  if (!alert) return null;
  const isWarning = alert.severity === 'warning';
  return (
    <div
      style={{
        marginTop: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.75rem',
        backgroundColor: isWarning ? 'var(--badge-warning-bg)' : 'var(--badge-danger-bg)',
        borderRadius: 'var(--radius-md)',
        color: isWarning ? 'var(--badge-warning-text)' : 'var(--badge-danger-text)',
        border: `1px solid ${isWarning ? 'var(--badge-warning-border)' : 'var(--badge-danger-border)'}`,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginTop: '0.1rem', flexShrink: 0 }}
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" x2="12" y1="9" y2="13" />
        <line x1="12" x2="12.01" y1="17" y2="17" />
      </svg>
      <span style={{ fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.4 }}>
        {useBusiness
          ? alert.message
              .replace('Pass rate critique:', 'Critique :')
              .replace('Pass rate en warning:', 'Attention :')
              .replace('Trop de tests bloqués:', 'Blocages élevés :')
              .replace('Avancement insuffisant:', 'Retard :')
          : alert.message}
      </span>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  value: number;
  color: string;
  arrow: string;
  badge: React.ReactNode;
  label: string;
  description?: string;
  alert?: MetricAlert | null;
  useBusiness?: boolean;
  trend?: Trend | null;
}

export default function MetricCard({
  title,
  icon: Icon,
  value,
  color,
  arrow,
  badge,
  label,
  description,
  alert,
  useBusiness,
  trend,
}: MetricCardProps) {
  return (
    <div
      className="metric-card"
      style={{
        backgroundColor: 'var(--card-bg)',
        padding: '1.25rem',
        borderRadius: '12px',
        border: `1px solid ${color}`,
        borderLeftWidth: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-muted)',
          marginBottom: '0.5rem',
        }}
      >
        <Icon size={24} color={color} />
        <span style={{ fontWeight: 600, fontSize: '1.4rem', color: 'var(--text-color)' }}>{title}</span>
        <TrendBadge trend={trend} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <div style={{ fontSize: '3rem', fontWeight: 800, color }}>{value}%</div>
        <span style={{ fontSize: '1.75rem', color }}>{arrow}</span>
      </div>
      <div
        style={{
          marginTop: '0.75rem',
          fontSize: '1.05rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            padding: '0.2rem 0.6rem',
            backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
            color,
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      {description && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {description}
        </div>
      )}
      <AlertItem alert={alert} useBusiness={useBusiness} />
    </div>
  );
}
