import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickClosureModal from './QuickClosureModal';

const mockShowToast = vi.fn();

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../services/api.service', () => ({
  default: {
    getAnnualTrends: vi.fn(),
  },
}));

vi.mock('../utils/docxGenerator', () => ({
  generateQuickClosureDoc: vi.fn(),
}));

import apiService from '../services/api.service';
import { generateQuickClosureDoc } from '../utils/docxGenerator';

describe('QuickClosureModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    metrics: {
      runs: [
        { id: 1, name: 'R01', created_at: '2024-01-15T10:00:00Z', passRate: 60 },
        { id: 2, name: 'R02', created_at: '2024-02-20T10:00:00Z', passRate: 55 },
      ],
      preprodMilestone: 'M1',
    },
    project: { id: 1, name: 'Alpha Project' },
    useBusiness: true,
    isDark: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getAnnualTrends.mockResolvedValue({ data: [] });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<QuickClosureModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with title and milestone', () => {
    render(<QuickClosureModal {...baseProps} />);
    expect(screen.getByText(/Quick Clôture ISTQB/i)).toBeInTheDocument();
    expect(screen.getByText(/M1/)).toBeInTheDocument();
  });

  it('computes default dates from metrics runs', async () => {
    const { container } = render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => {
      const dateInputs = container.querySelectorAll('input[type="date"]');
      expect(dateInputs[0]).toHaveValue('2024-01-15');
      expect(dateInputs[1]).toHaveValue('2024-02-20');
    });
  });

  it('falls back to last run date when no run has passRate > 50', async () => {
    const props = {
      ...baseProps,
      metrics: {
        runs: [
          { id: 1, name: 'R01', created_at: '2024-01-15T10:00:00Z', passRate: 40 },
          { id: 2, name: 'R02', created_at: '2024-02-20T10:00:00Z', passRate: 30 },
        ],
      },
    };
    const { container } = render(<QuickClosureModal {...props} />);
    await waitFor(() => {
      const dateInputs = container.querySelectorAll('input[type="date"]');
      expect(dateInputs[1]).toHaveValue('2024-02-20');
    });
  });

  it('allows changing environment and dates', async () => {
    const { container } = render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Environnement/i)).toBeInTheDocument();
    });
    const envInput = container.querySelector('input[type="text"]');
    fireEvent.change(envInput, { target: { value: 'Production' } });
    expect(envInput).toHaveValue('Production');

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2024-03-01' } });
    expect(dateInputs[0]).toHaveValue('2024-03-01');
  });

  it('adds, updates and removes bugs', async () => {
    render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Bugs Majeurs\/Critiques Restants/i)).toBeInTheDocument();
    });

    // Remove initial bug
    const removeBtn = screen.getByTitle('Supprimer');
    fireEvent.click(removeBtn);
    expect(screen.getByText(/Aucun bug critique restant/i)).toBeInTheDocument();

    // Add bug
    const addBtn = screen.getByRole('button', { name: /Ajouter/i });
    fireEvent.click(addBtn);

    const descInput = screen.getByPlaceholderText(/Description du ticket/i);
    fireEvent.change(descInput, { target: { value: 'BUG-123' } });
    expect(descInput).toHaveValue('BUG-123');

    const severitySelect = screen.getByDisplayValue('Majeur');
    fireEvent.change(severitySelect, { target: { value: 'Critique' } });
    expect(severitySelect).toHaveValue('Critique');
  });

  it('loads and displays historical trends', async () => {
    apiService.getAnnualTrends.mockResolvedValue({
      data: [
        { version: 'R01', date: '2024-01-15T10:00:00Z', detectionRate: 85, bugsInTest: 2 },
        { version: 'R02', date: '2024-02-20T10:00:00Z', detectionRate: 90, bugsInTest: 1 },
      ],
    });

    render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText('R01')).toBeInTheDocument();
      expect(screen.getByText('R02')).toBeInTheDocument();
    });
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('selects up to 2 historical runs', async () => {
    apiService.getAnnualTrends.mockResolvedValue({
      data: [
        { version: 'R01', date: '2024-01-15T10:00:00Z', detectionRate: 85, bugsInTest: 2 },
        { version: 'R02', date: '2024-02-20T10:00:00Z', detectionRate: 90, bugsInTest: 1 },
        { version: 'R03', date: '2024-03-10T10:00:00Z', detectionRate: 92, bugsInTest: 0 },
      ],
    });

    render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => expect(screen.getByText('R01')).toBeInTheDocument());

    const runs = screen.getAllByText(/R0[123]/).map((el) => el.closest('div[style*="cursor: pointer"]'));
    fireEvent.click(runs[0]);
    fireEvent.click(runs[1]);
    expect(screen.getByText('2/2 sélectionnés')).toBeInTheDocument();

    // Selecting a third should replace the first
    fireEvent.click(runs[2]);
    expect(screen.getByText('2/2 sélectionnés')).toBeInTheDocument();
  });

  it('handles export success', async () => {
    const blob = new Blob(['test']);
    generateQuickClosureDoc.mockResolvedValue(blob);

    render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Générer DOCX/i })).toBeInTheDocument());

    const exportBtn = screen.getByRole('button', { name: /Générer DOCX/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(generateQuickClosureDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          currentMetrics: baseProps.metrics,
          project: baseProps.project,
          environment: 'Préprod',
        })
      );
      expect(baseProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles export error and shows toast', async () => {
    generateQuickClosureDoc.mockRejectedValue(new Error('fail'));

    render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Générer DOCX/i })).toBeInTheDocument());

    const exportBtn = screen.getByRole('button', { name: /Générer DOCX/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Erreur lors de la génération du document DOCX.', 'error');
    });
  });

  it('closes on cancel button click', async () => {
    render(<QuickClosureModal {...baseProps} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('closes on X button click', () => {
    render(<QuickClosureModal {...baseProps} />);
    const closeBtn = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(closeBtn);
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
