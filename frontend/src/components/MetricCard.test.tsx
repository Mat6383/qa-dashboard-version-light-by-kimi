import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';

const MockIcon = ({ size, color }: { size?: number; color?: string }) => <svg data-testid="icon" style={{ width: size, color }} />;

describe('MetricCard', () => {
  it('affiche les données principales', () => {
    render(
      <MetricCard
        title="Pass Rate"
        icon={MockIcon}
        value={85}
        color="#3B82F6"
        arrow="↑"
        badge="OK"
        label="Bien"
      />
    );
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('affiche la description si fournie', () => {
    render(
      <MetricCard
        title="Titre"
        icon={MockIcon}
        value={50}
        color="#EF4444"
        arrow="↓"
        badge="KO"
        label="Mauvais"
        description="Détail ici"
      />
    );
    expect(screen.getByText('Détail ici')).toBeInTheDocument();
  });

  it('affiche une alerte business', () => {
    render(
      <MetricCard
        title="Titre"
        icon={MockIcon}
        value={50}
        color="#EF4444"
        arrow="↓"
        badge="KO"
        label="Mauvais"
        alert={{ severity: 'warning', message: 'Pass rate en warning: faible' }}
        useBusiness={true}
      />
    );
    expect(screen.getByText('Attention : faible')).toBeInTheDocument();
  });
});
