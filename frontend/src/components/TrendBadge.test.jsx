import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrendBadge from './TrendBadge';

describe('TrendBadge', () => {
  it('ne rend rien si trend est null', () => {
    const { container } = render(<TrendBadge trend={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche ↑ pour direction up', () => {
    render(<TrendBadge trend={{ direction: 'up', zScore: 2.5, mean: 80, severity: 'warning' }} />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it('affiche ↓ pour direction down', () => {
    render(<TrendBadge trend={{ direction: 'down', zScore: -2.5, mean: 80, severity: 'critical' }} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it('affiche → pour direction stable', () => {
    render(<TrendBadge trend={{ direction: 'stable', zScore: 0.2, mean: 80, severity: 'normal' }} />);
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it('affiche le z-score positif avec signe +', () => {
    render(<TrendBadge trend={{ direction: 'up', zScore: 1.5, mean: 80, severity: 'normal' }} />);
    expect(screen.getByText(/\+1\.5/)).toBeInTheDocument();
  });

  it('affiche le z-score négatif sans signe', () => {
    render(<TrendBadge trend={{ direction: 'down', zScore: -1.5, mean: 80, severity: 'normal' }} />);
    expect(screen.getByText(/-1\.5/)).toBeInTheDocument();
  });
});
