import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import Dashboard4 from './Dashboard4';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function Wrapper({ children }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({ lastLiveEventAt: null }),
}));

vi.mock('../hooks/queries/useReadiness', () => ({
  useReadiness: () => ({
    data: {
      project_id: 1,
      score: 92,
      status: 'ready',
      factors: [{ name: 'passRate', status: 'good', value: 95.5, impact: 35 }],
    },
    isLoading: false,
  }),
}));

vi.mock('../hooks/queries/useSyncHistory', () => ({
  useSyncHistory: () => ({ data: [], isLoading: false }),
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

vi.mock('../services/api.service', () => ({
  default: {
    getAnnualTrends: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: [
          {
            version: '2025',
            date: '2025-01-01',
            passRate: 90,
            completionRate: 85,
            blockedRate: 2,
            totalTests: 100,
            bugsInTest: 5,
            bugsInProd: 1,
            totalBugs: 6,
            detectionRate: 83,
            escapeRate: 17,
          },
        ],
      })
    ),
    getSyncProjects: vi.fn(() => Promise.resolve([])),
    getSyncHistory: vi.fn(() => Promise.resolve([])),
    getSyncIterations: vi.fn(() => Promise.resolve([])),
    previewSync: vi.fn(() => Promise.resolve({})),
    getProjectMilestones: vi.fn(() => Promise.resolve({ result: [] })),
  },
  apiClient: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}));

vi.mock('react-chartjs-2', () => ({
  Doughnut: () => <div data-testid="mock-doughnut">Doughnut Chart</div>,
  Line: () => <div data-testid="mock-line">Line Chart</div>,
  Bar: () => <div data-testid="mock-bar">Bar Chart</div>,
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
    />,
    { wrapper: Wrapper }
  );
}

describe('Dashboard4', () => {
  it('affiche le skeleton si metrics ou project sont absents', () => {
    render(<Dashboard4 metrics={null} project={null} />, { wrapper: Wrapper });
    expect(screen.getByLabelText(/Chargement du dashboard/i)).toBeInTheDocument();
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

  it("affiche l'onglet Tendances Annuelles au clic", async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /Tendances Annuelles/i }));
    expect(await screen.findByText(/TENDANCES ANNUELLES DE QUALITÉ/i)).toBeInTheDocument();
  });

  it("affiche l'onglet Sync GitLab → Testmo au clic", async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /Sync GitLab → Testmo/i }));
    expect(await screen.findByText(/SYNCHRONISATION GITLAB → TESTMO/i)).toBeInTheDocument();
  });

  it("n'affiche pas le loader global quand metrics est null sur un onglet secondaire", () => {
    render(
      <Dashboard4
        metrics={null}
        project={null}
        projects={[mockProject]}
        projectId={1}
        onProjectChange={vi.fn()}
        isDark={false}
        useBusiness={true}
        setExportHandler={vi.fn()}
        showProductionSection={true}
        onToggleProductionSection={vi.fn()}
      />,
      { wrapper: Wrapper }
    );
    fireEvent.click(screen.getByRole('tab', { name: /Sync GitLab → Testmo/i }));
    expect(screen.queryByText(/Chargement des données ISTQB/i)).not.toBeInTheDocument();
    expect(screen.getByText(/SYNCHRONISATION GITLAB → TESTMO/i)).toBeInTheDocument();
  });

  it('affiche les runs exploratoires liés à la milestone quand le toggle est ON', () => {
    const metricsWithManyRuns = {
      ...mockMetrics,
      runs: [
        ...Array.from({ length: 15 }, (_, i) => ({
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
          milestone: 1,
        })),
        {
          id: 'exp-1',
          name: 'Session exploratoire M1',
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
          milestone: 1,
        },
        {
          id: 'exp-2',
          name: 'Session exploratoire M2',
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
          milestone: 99,
        },
      ],
    };
    renderDashboard({
      metrics: metricsWithManyRuns,
      selectedPreprodMilestones: [1],
    });
    fireEvent.click(screen.getByText('Exploratoires'));
    expect(screen.getByText('Session exploratoire M1')).toBeInTheDocument();
    expect(screen.queryByText('Session exploratoire M2')).not.toBeInTheDocument();
  });

  it('ne duplique pas un run exploratoire déjà dans la liste de base', () => {
    const metricsWithDuplicate = {
      ...mockMetrics,
      runs: [
        {
          id: 'run-1',
          name: 'R10 - run 1',
          isExploratory: false,
          milestone: 1,
        },
        {
          id: 'exp-1',
          name: 'Session exploratoire',
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
          milestone: 1,
        },
      ],
    };
    renderDashboard({
      metrics: metricsWithDuplicate,
      selectedPreprodMilestones: [1],
    });
    fireEvent.click(screen.getByText('Exploratoires'));
    const cards = screen.getAllByText('Session exploratoire');
    expect(cards.length).toBe(1);
  });
});
