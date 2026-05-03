import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  it('ne rend rien sans message', () => {
    const { container } = render(<Toast message="" onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche le message', () => {
    render(<Toast message="Hello" onClose={vi.fn()} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('appelle onClose après la durée', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Auto" onClose={onClose} duration={1000} />);
    await vi.advanceTimersByTimeAsync(1300);
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('ferme au clic sur le bouton X', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Close me" onClose={onClose} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await vi.advanceTimersByTimeAsync(400);
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
