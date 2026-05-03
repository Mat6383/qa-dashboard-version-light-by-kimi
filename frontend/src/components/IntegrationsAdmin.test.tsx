import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IntegrationsAdmin from './IntegrationsAdmin';

vi.mock('../trpc/client', () => ({
  trpc: {
    useUtils: () => ({ integrations: { list: { invalidate: vi.fn() } } }),
    integrations: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
      testConnection: { useMutation: () => ({ mutate: vi.fn(), isPending: false, data: null }) },
    },
  },
}));

describe('IntegrationsAdmin', () => {
  it('affiche le bouton Ajouter', () => {
    render(<IntegrationsAdmin isDark={false} />);
    expect(screen.getByText(/Ajouter/i)).toBeInTheDocument();
  });

  it('ouvre le formulaire et contient GitLab dans le select', () => {
    render(<IntegrationsAdmin isDark={false} />);
    fireEvent.click(screen.getByText(/Ajouter/i));
    expect(screen.getByText('GitLab')).toBeInTheDocument();
  });
});
