import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard7 from './Dashboard7';
import apiService from '../services/api.service';
import { ToastProvider } from '../contexts/ToastContext';
import { ThemeProvider } from '../contexts/ThemeContext';

vi.mock('../services/api.service', () => ({
  default: {
    getCrosstestIterations: vi.fn(),
    getCrosstestComments: vi.fn(),
    getCrosstestIssues: vi.fn(),
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        key: `row-${i}`,
        index: i,
        size: 64,
        start: i * 64,
      })),
    getTotalSize: () => count * 64,
  }),
}));

function Wrapper({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

describe('Dashboard7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders iterations and issues', async () => {
    apiService.getCrosstestIterations.mockResolvedValue([{ id: 1, title: 'Sprint 1', state: 'opened' }]);
    apiService.getCrosstestComments.mockResolvedValue({});
    apiService.getCrosstestIssues.mockResolvedValue([
      {
        iid: 42,
        title: 'Bug fix',
        url: 'http://gitlab.test/issue/42',
        assignees: ['Alice'],
        labels: ['CrossTest::OK'],
        state: 'opened',
      },
    ]);

    render(<Dashboard7 isDark={false} />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('1'));
    await waitFor(() => expect(screen.getByText('Bug fix')).toBeInTheDocument());
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders many issues with virtualizer total height', async () => {
    apiService.getCrosstestIterations.mockResolvedValue([{ id: 1, title: 'Sprint 1', state: 'opened' }]);
    apiService.getCrosstestComments.mockResolvedValue({});

    const manyIssues = Array.from({ length: 200 }, (_, i) => ({
      iid: i + 1,
      title: `Issue ${i + 1}`,
      url: `http://gitlab.test/issue/${i + 1}`,
      assignees: [],
      labels: ['CrossTest::OK'],
      state: 'opened',
    }));
    apiService.getCrosstestIssues.mockResolvedValue(manyIssues);

    render(<Dashboard7 isDark={false} />, { wrapper: Wrapper });

    await waitFor(() => {
      const summary = document.querySelector('.d7-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('200');
      expect(summary.textContent).toContain('tickets');
    });

    const tbody = document.querySelector('tbody');
    expect(tbody).toBeTruthy();
    expect(tbody.style.height).toBe('12800px');
  });
});
