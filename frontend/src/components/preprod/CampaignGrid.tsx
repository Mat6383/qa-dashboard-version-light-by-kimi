import React from 'react';
import { Database } from 'lucide-react';
import CampaignCard from './CampaignCard';
import type { Run } from '../../types/api.types';

interface CampaignGridProps {
  sortedRuns: Run[];
  originalRunsCount?: number;
  showAllRuns: boolean;
  setShowAllRuns: (show: boolean) => void;
  showLatestOnly?: boolean;
  setShowLatestOnly?: (show: boolean) => void;
  showExploratoryByMilestone?: boolean;
  setShowExploratoryByMilestone?: (show: boolean) => void;
  useBusiness: boolean;
  isDark: boolean;
}

export default function CampaignGrid({
  sortedRuns,
  originalRunsCount,
  showAllRuns,
  setShowAllRuns,
  showLatestOnly = false,
  setShowLatestOnly,
  showExploratoryByMilestone = false,
  setShowExploratoryByMilestone,
  useBusiness,
  isDark,
}: CampaignGridProps) {
  const normalRuns = showExploratoryByMilestone
    ? sortedRuns.filter((r) => !r.isExploratory)
    : sortedRuns;
  const exploratoryRuns = showExploratoryByMilestone
    ? sortedRuns.filter((r) => r.isExploratory)
    : [];

  const displayCount = showAllRuns
    ? normalRuns.length
    : normalRuns.length <= 12
      ? 12
      : 8;
  const visibleNormal = normalRuns.slice(0, displayCount);
  const visibleRuns = [...visibleNormal, ...exploratoryRuns];
  const totalCount = originalRunsCount ?? sortedRuns.length;
  const hasMore = normalRuns.length > displayCount && !showAllRuns;

  return (
    <div className="pp-campaigns">
      <h3 className="pp-campaigns-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={24} color="var(--color-primary)" /> Campagnes Actives (Préproduction)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {setShowLatestOnly && (
            <Toggle
              label={useBusiness ? 'Dernier actif' : 'Latest only'}
              checked={showLatestOnly}
              onChange={() => setShowLatestOnly(!showLatestOnly)}
            />
          )}
          {setShowExploratoryByMilestone && (
            <Toggle
              label={useBusiness ? 'Exploratoires' : 'Exploratory'}
              checked={showExploratoryByMilestone}
              onChange={() => setShowExploratoryByMilestone(!showExploratoryByMilestone)}
            />
          )}
          <Toggle
            label={useBusiness ? 'Tout afficher' : 'Show All'}
            checked={showAllRuns}
            onChange={() => setShowAllRuns(!showAllRuns)}
          />
        </div>
      </h3>
      <div className="pp-campaigns-grid">
        {visibleRuns.map((run) => (
          <CampaignCard key={run.id} run={run} useBusiness={useBusiness} isDark={isDark} />
        ))}
        {hasMore && (
          <div className="pp-show-more">
            + {totalCount - 8} {useBusiness ? 'autres campagnes...' : 'other campaigns...'}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div
      className="pp-toggle"
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
    >
      <span
        className="pp-toggle-label"
        style={{ color: checked ? 'var(--color-primary)' : 'var(--text-muted)' }}
      >
        {label}
      </span>
      <div
        className={`pp-toggle-track ${checked ? 'pp-toggle-track--on' : ''}`}
        style={{
          backgroundColor: checked ? 'var(--action-success-bg)' : 'var(--surface-muted)',
          border: checked ? '1px solid #059669' : '1px solid var(--border-color)',
          boxShadow: checked ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <div className={`pp-toggle-knob ${checked ? 'pp-toggle-knob--on' : 'pp-toggle-knob--off'}`}>
          {checked && (
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text-success)' }} />
          )}
        </div>
      </div>
    </div>
  );
}
