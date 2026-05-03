import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Dashboard4 from './Dashboard4';

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('html2canvas', () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ toDataURL: () => 'data:image/png;base64,xxx' })),
}));

vi.mock('jspdf', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}));

const mockMetrics = {
  raw: { completed: 80, total: 100, passed: 70, failed: 5, wip: 3, blocked: 2, untested: 20 },
  runs: [
    { id: 'run-1', name: 'R10 - run 1', isExploratory: false },
    { id: 'run-2', name: 'Session exploratoire', isExploratory: true },
  ],
  qualityRates: {
    escapeRate: 2,
    detectionRate: 98,
    bugsInProd: 1,
    bugsInTest: 45,
    preprodMilestone: 'M3',
    prodMilestone: 'M4',
  },
  slaStatus: { ok: true, alerts: [] },
};

const mockProject = { id: 1, name: 'neo-pilot' };

function renderDashboard(props = {}) {
  return render(
    <Dashboard4
      metrics={mockMetrics}
      project={mockProject}
      projects={[mockProject]}
      projectId={1}
      onProjectChange={vi.fn()}
      isDark={false}
      useBusiness={true}
      setExportHandler={vi.fn()}
      showProductionSection={true}
      onToggleProductionSection={vi.fn()}
      {...props}
    />
  );
}

describe('Dashboard4', () => {
  it('affiche le loader si metrics ou project sont absents', () => {
    render(<Dashboard4 metrics={null} project={null} />);
    expect(screen.getByText(/Chargement des données ISTQB/i)).toBeInTheDocument();
  });

  it('affiche le dashboard quand les données sont présentes', () => {
    renderDashboard();
    expect(screen.getByText(/Taux d'Exécution/i)).toBeInTheDocument();
  });

  it('affiche la section Production quand showProductionSection est true', () => {
    renderDashboard();
    expect(screen.getByText(/Taux d'Échappement/i)).toBeInTheDocument();
  });

  it('masque la section Production quand showProductionSection est false', () => {
    renderDashboard({ showProductionSection: false });
    expect(screen.queryByText(/Taux d'Échappement/i)).not.toBeInTheDocument();
  });
});
