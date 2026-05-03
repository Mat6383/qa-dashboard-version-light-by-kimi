import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MultiProjectDashboard from './MultiProjectDashboard';

const mockUseQuery = vi.fn();

vi.mock('../hooks/queries/useMultiProjectSummary', () => ({
  useMultiProjectSummary: () => mockUseQuery(),
}));

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

describe('MultiProjectDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true, error: null });
    render(<MultiProjectDashboard isDark={false} />, { wrapper: Wrapper });
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });

  it('renders multi-project summary', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          projectId: 1,
          projectName: 'Alpha',
          passRate: 92.5,
          completionRate: 88.0,
          blockedRate: 2.0,
          escapeRate: 5.0,
          detectionRate: 95.0,
          slaStatus: { ok: true, alerts: [] },
        },
        {
          projectId: 2,
          projectName: 'Beta',
          passRate: 80.0,
          completionRate: 75.0,
          blockedRate: 8.0,
          escapeRate: 12.0,
          detectionRate: 88.0,
          slaStatus: { ok: false, alerts: [{ severity: 'critical', metric: 'Pass Rate' }] },
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<MultiProjectDashboard isDark={false} />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('92.5%')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('renders error state on failure', async () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Network error'),
    });
    render(<MultiProjectDashboard isDark={false} />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});
