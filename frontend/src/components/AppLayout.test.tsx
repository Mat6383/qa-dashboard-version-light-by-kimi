import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';

const mockUseIsMobile = vi.fn();
vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

function renderAppLayout(props = {}) {
  const defaultProps = {
    children: <div data-testid="main-content">Content</div>,
    darkMode: false,
    tvMode: false,
    toggleDarkMode: vi.fn(),
    toggleTvMode: vi.fn(),
    useBusinessTerms: false,
    setUseBusinessTerms: vi.fn(),
    autoRefresh: false,
    setAutoRefresh: vi.fn(),
    projectId: '1',
    projects: [{ id: '1', name: 'Projet A' }],
    onProjectChange: vi.fn(),
    onDashboardChange: vi.fn(),
    onRefresh: vi.fn(),
    onClearCache: vi.fn(),
    loading: false,
    backendStatus: 'ok',
    lastUpdate: null,
    currentPath: '/',
    exportHandler: null,
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    onLogin: vi.fn(),
    onLogout: vi.fn(),
    onExportPdfBackend: null,
    onExportCSV: null,
    onExportExcel: null,
    liveConnected: false,
    liveError: null,
    circuitBreakers: [],
    compactMode: false,
    toggleCompactMode: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <AppLayout {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('AppLayout mobile', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(true);
  });

  it('shows hamburger menu on mobile', () => {
    renderAppLayout();
    expect(screen.getByLabelText(/menu/i)).toBeInTheDocument();
  });

  it('opens drawer when hamburger clicked', () => {
    renderAppLayout();
    fireEvent.click(screen.getByLabelText(/menu/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows bottom nav on mobile', () => {
    renderAppLayout({ isAdmin: true });
    expect(screen.getByLabelText('Navigation principale')).toBeInTheDocument();
  });

  it('hides subtitle on mobile', () => {
    renderAppLayout();
    expect(screen.queryByText(/ISTQB Compliant \| LEAN Optimized/i)).not.toBeInTheDocument();
  });
});

describe('AppLayout desktop', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(false);
  });

  it('shows full header controls on desktop', () => {
    renderAppLayout();
    expect(screen.getByTestId('compact-mode-toggle')).toBeInTheDocument();
  });

  it('does not show bottom nav on desktop', () => {
    renderAppLayout();
    expect(screen.queryByLabelText('Navigation principale')).not.toBeInTheDocument();
  });
});
