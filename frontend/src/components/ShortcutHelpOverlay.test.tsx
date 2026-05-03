import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ShortcutHelpOverlay from './ShortcutHelpOverlay';

describe('ShortcutHelpOverlay', () => {
  it('renders shortcuts list when open', () => {
    render(<ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Raccourcis clavier')).toBeInTheDocument();
    expect(screen.getByText('Échap')).toBeInTheDocument();
    expect(screen.getByText('Fermer le modal')).toBeInTheDocument();
    expect(screen.getByText('Entrée')).toBeInTheDocument();
    expect(screen.getByText("Confirmer l'action principale")).toBeInTheDocument();
    expect(screen.getByText('Ctrl + S')).toBeInTheDocument();
    expect(screen.getByText('Sauvegarder le formulaire')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Afficher / masquer cette aide')).toBeInTheDocument();
  });

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay isOpen={true} onClose={onClose} />);
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutHelpOverlay isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
