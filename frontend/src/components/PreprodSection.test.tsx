import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PreprodSection from './PreprodSection';

vi.mock('../services/api.service', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockMetrics = {
  completionRate: 90,
  passRate: 85,
  failureRate: 5,
  blockedRate: 2,
  escapeRate: 3,
  detectionRate: 97,
  testEfficiency: 88,
  qualityRates: null,
  raw: {
    completed: 90,
    total: 100,
    passed: 85,
    failed: 5,
    blocked: 2,
    skipped: 3,
    wip: 1,
    untested: 4,
    success: 85,
    failure: 5,
  },
  runs: [
    {
      id: 1,
      name: 'Run 1',
      total: 50,
      completed: 45,
      passed: 40,
      failed: 3,
      blocked: 1,
      skipped: 1,
      wip: 0,
      untested: 5,
      completionRate: 90,
      passRate: 88,
      created_at: '2026-05-18T10:00:00Z',
      milestone: 1,
      isExploratory: false,
    },
  ],
  slaStatus: { ok: true, alerts: [] },
} as any;

const mockSortedRuns = mockMetrics.runs;

const defaultProps = {
  metrics: mockMetrics,
  raw: mockMetrics.raw,
  sortedRuns: mockSortedRuns,
  originalRunsCount: 1,
  showAllRuns: false,
  setShowAllRuns: vi.fn(),
  showLatestOnly: false,
  setShowLatestOnly: vi.fn(),
  isDark: false,
  useBusiness: true,
  getAlertForMetric: () => undefined,
  anomalies: [],
  layout: ['completionRate', 'passRate', 'failureRate', 'testEfficiency'] as any,
  onMoveWidget: vi.fn(),
  dragEnabled: false,
  getTemporalForMetric: () => null,
  onExportCard: vi.fn(),
  onExportDoughnut: vi.fn(),
};

describe('PreprodSection', () => {
  it('renders without crashing', () => {
    render(<PreprodSection {...defaultProps} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('displays KPI cards with correct values', () => {
    render(<PreprodSection {...defaultProps} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows run list when showAllRuns is true', () => {
    render(<PreprodSection {...defaultProps} showAllRuns={true} />);
    expect(screen.getByText('Run 1')).toBeInTheDocument();
  });

  it('renders doughnut chart section', () => {
    render(<PreprodSection {...defaultProps} />);
    expect(screen.getByText(/Répartition/i)).toBeInTheDocument();
  });

  it('forwards showExploratoryByMilestone to CampaignGrid', () => {
    const setter = vi.fn();
    render(
      <PreprodSection
        {...defaultProps}
        showExploratoryByMilestone={true}
        setShowExploratoryByMilestone={setter}
      />
    );
    // CampaignGrid shows the toggle when setter is provided
    expect(screen.getByText('Exploratoires')).toBeInTheDocument();
  });
});
