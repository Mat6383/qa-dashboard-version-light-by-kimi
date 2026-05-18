import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CompareDashboard from './CompareDashboard';

const mockGet = vi.fn();

vi.mock('../services/api.service', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

describe('CompareDashboard', () => {
  const projects = [
    { id: 1, name: 'Project A' },
    { id: 2, name: 'Project B' },
    { id: 3, name: 'Project C' },
    { id: 4, name: 'Project D' },
    { id: 5, name: 'Project E' },
  ];

  const compareData = [
    { project_id: 1, project_name: 'Project A', pass_rate: 80, completion_rate: 90, escape_rate: 5, detection_rate: 95, blocked_rate: 2 },
    { project_id: 2, project_name: 'Project B', pass_rate: 70, completion_rate: 85, escape_rate: 6, detection_rate: 94, blocked_rate: 3 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and displays project list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve({ data: { projects } });
      return Promise.resolve({ data: { projects: compareData } });
    });
    render(<CompareDashboard isDark={false} />);
    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
    });
    expect(screen.getByText('Project B')).toBeInTheDocument();
  });

  it('shows error when projects fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    render(<CompareDashboard isDark={false} />);
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger/i)).toBeInTheDocument();
    });
  });

  it('allows selecting up to 4 projects', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve({ data: { projects } });
      return Promise.resolve({ data: { projects: compareData } });
    });
    render(<CompareDashboard isDark={false} />);
    await waitFor(() => screen.getByText('Project A'));

    fireEvent.click(screen.getByText('Project A'));
    fireEvent.click(screen.getByText('Project B'));
    fireEvent.click(screen.getByText('Project C'));
    fireEvent.click(screen.getByText('Project D'));
    fireEvent.click(screen.getByText('Project E'));

    await waitFor(() => {
      // 5th click should be ignored; compare should only be called for first 4 selections
      expect(mockGet).toHaveBeenCalledWith('/dashboard/compare', expect.any(Object));
    });
  });

  it('fetches compare data when 2+ projects selected', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve({ data: { projects } });
      return Promise.resolve({ data: { projects: compareData } });
    });
    render(<CompareDashboard isDark={false} />);
    await waitFor(() => screen.getByText('Project A'));

    fireEvent.click(screen.getByText('Project A'));
    fireEvent.click(screen.getByText('Project B'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/dashboard/compare', expect.objectContaining({
        params: expect.objectContaining({ project_ids: [1, 2] }),
      }));
    });
  });

  it('clears data when fewer than 2 projects selected', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve({ data: { projects } });
      return Promise.resolve({ data: { projects: compareData } });
    });
    render(<CompareDashboard isDark={false} />);
    await waitFor(() => screen.getByText('Project A'));

    fireEvent.click(screen.getByText('Project A'));
    fireEvent.click(screen.getByText('Project B'));
    await waitFor(() => expect(screen.queryByText('Project A')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Project B')[0]);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
