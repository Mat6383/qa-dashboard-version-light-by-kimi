import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogViewer from './AuditLogViewer';

const mockGetAuditLogs = vi.fn();

vi.mock('../services/api.service', () => ({
  default: {
    getAuditLogs: (f) => mockGetAuditLogs(f),
  },
}));

describe('AuditLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditLogs.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          timestamp: '2026-04-28T10:00:00Z',
          actor_email: 'admin@test.com',
          actor_role: 'admin',
          action: 'cache.clear',
          resource: 'cache',
          method: 'POST',
          path: '/api/cache/clear',
          status_code: 200,
          success: true,
          ip: '127.0.0.1',
        },
        {
          id: 2,
          timestamp: '2026-04-28T09:00:00Z',
          actor_email: 'viewer@test.com',
          actor_role: 'viewer',
          action: 'export.csv',
          resource: 'export',
          method: 'POST',
          path: '/api/export/csv',
          status_code: 200,
          success: true,
          ip: '127.0.0.1',
        },
      ],
      total: 2,
      limit: 50,
      offset: 0,
    });
  });

  it('renders audit log table', async () => {
    render(<AuditLogViewer isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Journal d'Audit/i)).toBeInTheDocument());
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('viewer@test.com')).toBeInTheDocument();
  });

  it('displays action labels instead of raw keys', async () => {
    render(<AuditLogViewer isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Nettoyage cache/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Export CSV/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no logs', async () => {
    mockGetAuditLogs.mockResolvedValue({ success: true, data: [], total: 0, limit: 50, offset: 0 });
    render(<AuditLogViewer isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Aucune entrée d'audit trouvée/i)).toBeInTheDocument());
  });

  it('filters by action type', async () => {
    render(<AuditLogViewer isDark={false} />);
    await waitFor(() => expect(screen.getByText('admin@test.com')).toBeInTheDocument());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cache.clear' } });

    await waitFor(() => {
      expect(mockGetAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'cache.clear', limit: 50, offset: 0 })
      );
    });
  });

  it('filters by date range', async () => {
    render(<AuditLogViewer isDark={false} />);
    await waitFor(() => expect(screen.getByText('admin@test.com')).toBeInTheDocument());

    const dateFrom = screen.getByTestId('audit-date-from');
    fireEvent.change(dateFrom, { target: { value: '2026-04-01' } });

    await waitFor(() => {
      expect(mockGetAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-04-01', limit: 50, offset: 0 })
      );
    });
  });

  it('shows pagination when there are multiple pages', async () => {
    mockGetAuditLogs.mockResolvedValue({
      success: true,
      data: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        timestamp: '2026-04-28T10:00:00Z',
        action: 'test',
        success: true,
      })),
      total: 120,
      limit: 50,
      offset: 0,
    });

    render(<AuditLogViewer isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Page 1/i)).toBeInTheDocument());
    expect(screen.getByText(/120 entrées/i)).toBeInTheDocument();
  });
});
