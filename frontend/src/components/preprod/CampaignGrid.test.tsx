import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CampaignGrid from './CampaignGrid';

const baseProps = {
  sortedRuns: [],
  showAllRuns: false,
  setShowAllRuns: vi.fn(),
  showLatestOnly: false,
  setShowLatestOnly: vi.fn(),
  useBusiness: true,
  isDark: false,
};

describe('CampaignGrid', () => {
  it('renders exploratory toggle when setter is provided', () => {
    render(
      <CampaignGrid
        {...baseProps}
        showExploratoryByMilestone={false}
        setShowExploratoryByMilestone={vi.fn()}
      />
    );
    expect(screen.getByText('Exploratoires')).toBeInTheDocument();
  });

  it('does not render exploratory toggle when setter is absent', () => {
    render(<CampaignGrid {...baseProps} />);
    expect(screen.queryByText('Exploratoires')).not.toBeInTheDocument();
  });

  it('calls setShowExploratoryByMilestone on toggle click', () => {
    const setter = vi.fn();
    render(
      <CampaignGrid
        {...baseProps}
        showExploratoryByMilestone={false}
        setShowExploratoryByMilestone={setter}
      />
    );
    fireEvent.click(screen.getByText('Exploratoires'));
    expect(setter).toHaveBeenCalledWith(true);
  });

  it('shows English label when useBusiness is false', () => {
    render(
      <CampaignGrid
        {...baseProps}
        useBusiness={false}
        showExploratoryByMilestone={false}
        setShowExploratoryByMilestone={vi.fn()}
      />
    );
    expect(screen.getByText('Exploratory')).toBeInTheDocument();
  });

  it('always shows exploratory runs when toggle is ON regardless of normal limit', () => {
    const normalRuns = Array.from({ length: 15 }, (_, i) => ({
      id: `run-${i}`,
      name: `Run ${i}`,
      total: 10,
      completed: 5,
      passed: 5,
      failed: 0,
      blocked: 0,
      skipped: 0,
      wip: 0,
      untested: 0,
      completionRate: 50,
      passRate: 100,
      isExploratory: false,
      isClosed: false,
      created_at: '2026-05-18T10:00:00Z',
    }));
    const exploratoryRuns = [
      {
        id: 'exp-1',
        name: 'Session 1',
        total: 5,
        completed: 3,
        passed: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        wip: 0,
        untested: 2,
        completionRate: 60,
        passRate: 100,
        isExploratory: true,
        isClosed: false,
        created_at: '2026-05-18T10:00:00Z',
      },
    ];
    render(
      <CampaignGrid
        {...baseProps}
        sortedRuns={[...normalRuns, ...exploratoryRuns]}
        showExploratoryByMilestone={true}
        setShowExploratoryByMilestone={vi.fn()}
      />
    );
    // 8 normal runs + 1 exploratory should be visible
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('+ 8 autres campagnes...')).toBeInTheDocument();
  });
});
