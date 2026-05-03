import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TestClosureModal from './TestClosureModal';

const mockShowToast = vi.fn();
const mockExportPDF = vi.fn();

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../hooks/useExportPDF', () => ({
  useExportPDF: () => ({ exportPDF: mockExportPDF, isExporting: false }),
}));

describe('TestClosureModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    metrics: {
      runs: [
        { id: 1, name: 'R01', created_at: '2024-01-15T10:00:00Z', passRate: 60, completionRate: 90, failureRate: 5 },
        { id: 2, name: 'R02', created_at: '2024-02-20T10:00:00Z', passRate: 55, completionRate: 85, failureRate: 10 },
      ],
      completionRate: 87,
      passRate: 92,
      failureRate: 8,
    },
    project: { id: 1, name: 'Alpha' },
    useBusiness: true,
    isDark: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<TestClosureModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with title and detected version', async () => {
    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Bilan de Clôture de Test/i)).toBeInTheDocument();
    });
    const versionInput = screen.getByDisplayValue('R02');
    expect(versionInput).toBeInTheDocument();
  });

  it('computes default dates from metrics runs', async () => {
    const { container } = render(<TestClosureModal {...baseProps} />);
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
          { id: 1, name: 'R01', created_at: '2024-01-15T10:00:00Z', passRate: 40, completionRate: 80, failureRate: 15 },
          { id: 2, name: 'R02', created_at: '2024-02-20T10:00:00Z', passRate: 30, completionRate: 75, failureRate: 20 },
        ],
        completionRate: 77,
        passRate: 35,
        failureRate: 17,
      },
    };
    const { container } = render(<TestClosureModal {...props} />);
    await waitFor(() => {
      const dateInputs = container.querySelectorAll('input[type="date"]');
      expect(dateInputs[1]).toHaveValue('2024-02-20');
    });
  });

  it('displays global KPIs', async () => {
    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Rappel des Métriques Globales/i)).toBeInTheDocument();
    });
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('87%')).toBeInTheDocument(); // completionRate
    expect(within(modal).getByText('92%')).toBeInTheDocument(); // passRate
    expect(within(modal).getByText('8%')).toBeInTheDocument(); // failureRate
  });

  it('allows changing environment and decision', async () => {
    const { container } = render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText('Environnement')).toBeInTheDocument();
    });

    const envInput = container.querySelector('input[type="text"]');
    fireEvent.change(envInput, { target: { value: 'Production' } });
    expect(envInput).toHaveValue('Production');

    const decisionSelect = screen.getByDisplayValue(/GO PRODUCTION/i);
    fireEvent.change(decisionSelect, { target: { value: 'NO_GO' } });
    expect(decisionSelect).toHaveValue('NO_GO');
  });

  it('adds, updates and removes bugs', async () => {
    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Bugs Majeurs\/Critiques restants/i)).toBeInTheDocument();
    });

    // Remove initial bug
    const removeBtn = screen.getByTitle('Supprimer');
    fireEvent.click(removeBtn);
    expect(screen.getByText(/Aucun bug critique restant/i)).toBeInTheDocument();

    // Add bug
    const addBtn = screen.getByRole('button', { name: /Ajouter/i });
    fireEvent.click(addBtn);

    const descInput = screen.getByPlaceholderText(/Description du ticket/i);
    fireEvent.change(descInput, { target: { value: 'BUG-456' } });
    expect(descInput).toHaveValue('BUG-456');

    const severitySelect = screen.getByDisplayValue('Majeur');
    fireEvent.change(severitySelect, { target: { value: 'Critique' } });
    expect(severitySelect).toHaveValue('Critique');
  });

  it('updates residual risks and sign-offs', async () => {
    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Écarts & Risques Résiduels/i)).toBeInTheDocument();
    });

    const risksTextarea = screen.getByPlaceholderText(/Renseignez les impacts métier/i);
    fireEvent.change(risksTextarea, { target: { value: 'Risque 1' } });
    expect(risksTextarea).toHaveValue('Risque 1');

    const signOffTextarea = screen.getByPlaceholderText(/Product Owner/i);
    fireEvent.change(signOffTextarea, { target: { value: 'PO: Alice' } });
    expect(signOffTextarea).toHaveValue('PO: Alice');
  });

  it('handles export success and closes modal', async () => {
    mockExportPDF.mockResolvedValue(undefined);

    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Valider & Exporter \(PDF\)/i })).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Valider & Exporter \(PDF\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockExportPDF).toHaveBeenCalledTimes(2);
      expect(baseProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles export error and shows toast', async () => {
    mockExportPDF.mockRejectedValue(new Error('PDF generation failed'));

    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Valider & Exporter \(PDF\)/i })).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Valider & Exporter \(PDF\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Erreur lors de la génération des PDF', 'error');
    });
  });

  it('closes on cancel button click', async () => {
    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('closes on X button click', async () => {
    render(<TestClosureModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
    });
    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
