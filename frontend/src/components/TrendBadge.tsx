import React from 'react';
import type { Trend } from '../types/api.types';

interface TrendBadgeProps {
  trend: Trend | null | undefined;
  style?: React.CSSProperties;
}

export default function TrendBadge({ trend, style = {} }: TrendBadgeProps) {
  if (!trend) return null;

  const config = {
    up: { symbol: '↑', color: 'var(--text-success)', bg: 'var(--badge-success-bg)' },
    down: { symbol: '↓', color: 'var(--text-danger)', bg: 'var(--badge-danger-bg)' },
    stable: { symbol: '→', color: 'var(--text-muted)', bg: 'var(--badge-neutral-bg)' },
  };

  const { symbol, color, bg } = config[(trend.direction as keyof typeof config) || 'stable'];
  const severityBorder = trend.severity === 'critical' ? `1.5px solid ${color}` : 'none';

  return (
    <span
      title={`z-score: ${trend.zScore} | moyenne: ${trend.mean}`}
      style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        color,
        backgroundColor: bg,
        padding: '2px 6px',
        borderRadius: '4px',
        border: severityBorder,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        ...style,
      }}
    >
      {symbol} {trend.zScore > 0 ? `+${trend.zScore}` : trend.zScore}
    </span>
  );
}
