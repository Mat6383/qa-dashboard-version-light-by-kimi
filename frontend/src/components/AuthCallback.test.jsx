import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './AuthCallback';

const mockNavigate = vi.fn();
const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}));

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithSearchParams(search) {
    return render(
      <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('shows loading state', () => {
    renderWithSearchParams('');
    expect(screen.getByText(/Authentification en cours/i)).toBeInTheDocument();
  });

  it('calls refreshUser and redirects to home on success', async () => {
    renderWithSearchParams('');
    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('redirects to error on oauth failure', async () => {
    renderWithSearchParams('?error=access_denied');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/?error=oauth_failed');
    });
  });
});
