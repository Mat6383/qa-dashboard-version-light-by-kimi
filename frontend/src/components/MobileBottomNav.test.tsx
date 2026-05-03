import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('MobileBottomNav', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders nav items', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav isAdmin={false} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Navigation principale')).toBeInTheDocument();
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
  });

  it('navigates on click', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav isAdmin={false} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Global'));
    expect(mockNavigate).toHaveBeenCalledWith('/global-view');
  });

  it('shows admin item when isAdmin true', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav isAdmin />
      </MemoryRouter>
    );
    expect(screen.getByText('Flags')).toBeInTheDocument();
  });
});
