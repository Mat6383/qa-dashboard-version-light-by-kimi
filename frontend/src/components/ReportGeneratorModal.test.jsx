import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportGeneratorModal from './ReportGeneratorModal';

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('../services/api.service', () => ({
  default: {
    generateReport: vi.fn(),
  },
}));

import apiService from '../services/api.service';

describe('ReportGeneratorModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    metrics: {
      runs: [
        {
          id: 101,
          name: 'R01',
          passed: 80,
          failed: 5,
          total: 100,
          success_count: 80,
          failure_count: 5,
          total_count: 100,
          isExploratory: false,
        },
        {
          id: 102,
          name: 'R02',
          passed: 90,
          failed: 2,
          total: 100,
          success_count: 90,
          failure_count: 2,
          total_count: 100,
          isExploratory: false,
        },
        { id: 'session-1', name: 'Session exploratoire', passed: 10, failed: 0, total: 10, isExploratory: true },
      ],
    },
    project: { id: 1, name: 'Alpha' },
    isDark: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<ReportGeneratorModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with milestone and run stats', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    expect(screen.getByText(/Générer Rapport de Clôture/i)).toBeInTheDocument();
    expect(screen.getByText(/Périmètre — R01/)).toBeInTheDocument();
    expect(screen.getByText(/inclus dans le rapport/)).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument(); // total passed
    expect(screen.getByText('7')).toBeInTheDocument(); // total failed
    expect(screen.getByText('210')).toBeInTheDocument(); // total tests
  });

  it('shows warning when no standard runs are available', () => {
    const props = {
      ...baseProps,
      metrics: {
        runs: [
          { id: 'session-1', name: 'Session exploratoire', passed: 10, failed: 0, total: 10, isExploratory: true },
        ],
      },
    };
    render(<ReportGeneratorModal {...props} />);
    expect(screen.getByText(/Aucun run standard détecté/i)).toBeInTheDocument();
  });

  it('toggles format checkboxes', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const htmlCheckbox = screen.getAllByRole('checkbox')[0];
    const pptxCheckbox = screen.getAllByRole('checkbox')[1];

    expect(htmlCheckbox).toBeChecked();
    expect(pptxCheckbox).toBeChecked();

    fireEvent.click(htmlCheckbox);
    expect(htmlCheckbox).not.toBeChecked();

    fireEvent.click(pptxCheckbox);
    expect(pptxCheckbox).not.toBeChecked();
  });

  it('renders default recommendations', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    expect(screen.getByDisplayValue('Muda — Gaspillage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mura — Irrégularité')).toBeInTheDocument();
  });

  it('adds, updates and deletes a recommendation', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const addBtn = screen.getByRole('button', { name: /Ajouter une recommandation/i });
    fireEvent.click(addBtn);

    const inputs = screen.getAllByPlaceholderText('Catégorie...');
    expect(inputs.length).toBeGreaterThan(4); // 4 defaults + 1 new

    const lastCatInput = inputs[inputs.length - 1];
    fireEvent.change(lastCatInput, { target: { value: 'Nouvelle catégorie' } });
    expect(lastCatInput).toHaveValue('Nouvelle catégorie');

    const deleteBtns = screen.getAllByTitle('Supprimer');
    fireEvent.click(deleteBtns[deleteBtns.length - 1]);
    expect(screen.queryByDisplayValue('Nouvelle catégorie')).not.toBeInTheDocument();
  });

  it('updates recommendation text and priority', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const textareas = screen.getAllByPlaceholderText(/Constat et recommandation/i);
    fireEvent.change(textareas[0], { target: { value: 'Nouveau texte de reco' } });
    expect(textareas[0]).toHaveValue('Nouveau texte de reco');

    const prioritySelects = screen.getAllByTitle('Priorité');
    fireEvent.change(prioritySelects[0], { target: { value: 'low' } });
    expect(prioritySelects[0]).toHaveValue('low');
  });

  it('updates recommendation statut', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const statutSelects = screen.getAllByTitle('Statut');
    fireEvent.change(statutSelects[0], { target: { value: 'completed' } });
    expect(statutSelects[0]).toHaveValue('completed');
  });

  it('updates complement text', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const textarea = screen.getByPlaceholderText(/Contexte supplémentaire/i);
    fireEvent.change(textarea, { target: { value: 'Mon complément' } });
    expect(textarea).toHaveValue('Mon complément');
    expect(screen.getByText('14 caractères')).toBeInTheDocument();
  });

  it('shows error when no run ids are available', async () => {
    const props = {
      ...baseProps,
      metrics: { runs: [] },
    };
    render(<ReportGeneratorModal {...props} />);
    const generateBtn = screen.getByRole('button', { name: /Générer le rapport/i });
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(screen.getByText(/Aucun run de test disponible/i)).toBeInTheDocument();
    });
  });

  it('handles successful report generation', async () => {
    const mockResponse = {
      summary: { milestone: 'R01', verdict: 'GO', totalTests: 200, passRate: 85, failedTests: 7 },
      files: {
        html: 'aHRtbA==',
        htmlFilename: 'report.html',
        pptx: 'cHB0eA==',
        pptxFilename: 'report.pptx',
      },
    };
    apiService.generateReport.mockResolvedValue({ success: true, data: mockResponse });

    render(<ReportGeneratorModal {...baseProps} />);
    const generateBtn = screen.getByRole('button', { name: /Générer le rapport/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Télécharger HTML/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Télécharger PPTX/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Rapport R01 généré — Verdict : GO/i)).toBeInTheDocument();
  });

  it('handles generation error', async () => {
    apiService.generateReport.mockRejectedValue(new Error('Backend failure'));

    render(<ReportGeneratorModal {...baseProps} />);
    const generateBtn = screen.getByRole('button', { name: /Générer le rapport/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Backend failure/)).toBeInTheDocument();
    });
  });

  it('disables generate button when no format is selected', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const generateBtn = screen.getByRole('button', { name: /Générer le rapport/i });
    expect(generateBtn).toBeDisabled();
  });

  it('closes on overlay click', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('closes on X button click', () => {
    render(<ReportGeneratorModal {...baseProps} />);
    const closeBtn = screen.getByRole('button', { name: '' }); // X button
    fireEvent.click(closeBtn);
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('resets state when reopened', () => {
    const { rerender } = render(<ReportGeneratorModal {...baseProps} isOpen={false} />);
    rerender(<ReportGeneratorModal {...baseProps} isOpen={true} />);
    expect(screen.getByRole('button', { name: /Générer le rapport/i })).toBeInTheDocument();
  });
});
