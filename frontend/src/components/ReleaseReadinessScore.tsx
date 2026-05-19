import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';
import { useReadiness } from '../hooks/queries';
import type { ReadinessResult, ReadinessFactor } from '../types/api.types';

interface ReleaseReadinessScoreProps {
  projectId: number | null;
  preprodMilestones?: number[];
  prodMilestones?: number[];
  isDark?: boolean;
}

function getStatusColor(status: ReadinessResult['status'], isDark: boolean): string {
  switch (status) {
    case 'ready':
      return isDark ? '#4ade80' : '#16a34a';
    case 'caution':
      return isDark ? '#fbbf24' : '#d97706';
    case 'blocked':
      return isDark ? '#f87171' : '#dc2626';
    default:
      return '#9ca3af';
  }
}

function StatusIcon({ status }: { status: ReadinessResult['status'] }) {
  switch (status) {
    case 'ready':
      return <ShieldCheck size={14} />;
    case 'caution':
      return <ShieldAlert size={14} />;
    case 'blocked':
      return <ShieldX size={14} />;
    default:
      return <Shield size={14} />;
  }
}

function FactorItem({ factor, t }: { factor: ReadinessFactor; t: (key: string, options?: Record<string, unknown>) => string }) {
  const key = `readiness.factors.${factor.name}.${factor.status}`;
  const translated = t(key, { value: factor.value, defaultValue: `${factor.name}: ${factor.value}` });

  return (
    <span
      className={`readiness-score__factor readiness-score__factor--${factor.status}`}
      title={translated}
    >
      {translated}
    </span>
  );
}

export default function ReleaseReadinessScore({
  projectId,
  preprodMilestones,
  prodMilestones,
  isDark = false,
}: ReleaseReadinessScoreProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useReadiness(projectId, preprodMilestones || null, prodMilestones || null);
  const [expanded, setExpanded] = useState(false);

  if (!projectId || isLoading || !data) {
    return (
      <div className="readiness-score readiness-score--skeleton" title={t('readiness.calculating')}>
        <Shield size={14} />
        <span>—</span>
      </div>
    );
  }

  const color = getStatusColor(data.status, isDark);
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference - (data.score / 100) * circumference;
  const labelKey = `readiness.status.${data.status}`;
  const label = t(labelKey, { defaultValue: data.status });

  const visibleFactors = expanded ? data.factors : data.factors.slice(0, 3);
  const hasMore = data.factors.length > 3;

  return (
    <div className="readiness-score" title={label}>
      <div className="readiness-score__ring" style={{ color }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            opacity="0.2"
          />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 20 20)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span className="readiness-score__value" style={{ color }}>
          {data.score}
        </span>
      </div>
      <div className="readiness-score__info">
        <span className="readiness-score__label" style={{ color }}>
          <StatusIcon status={data.status} />
          {label}
        </span>
        {data.factors.length > 0 && (
          <div className="readiness-score__factors">
            {visibleFactors.map((f, idx) => (
              <FactorItem key={`${f.name}-${idx}`} factor={f} t={t} />
            ))}
            {hasMore && (
              <button
                className="readiness-score__factor readiness-score__factor--more"
                onClick={() => setExpanded((prev) => !prev)}
                type="button"
                title={expanded ? t('readiness.collapse') : t('readiness.expand')}
              >
                {expanded ? (
                  <>
                    <ChevronUp size={10} /> {t('readiness.collapse')}
                  </>
                ) : (
                  <>
                    <ChevronDown size={10} /> +{data.factors.length - 3} {t('readiness.more')}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
