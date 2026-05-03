import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './AuthCallback';

const mockNavigate = vi.fn();
const mockConsumeCallbackToken = vi.fn().mockReturnValue(true);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    consumeCallbackToken: mockConsumeCallbackToken,
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
    renderWithSearchParams('?token=abc');
    expect(screen.getByText(/Authentification en cours/i)).toBeInTheDocument();
  });

  it('consumes token and redirects to home', async () => {
    renderWithSearchParams('?token=valid-token');
    await waitFor(() => {
      expect(mockConsumeCallbackToken).toHaveBeenCalledWith('valid-token');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('redirects to error on oauth failure', async () => {
    renderWithSearchParams('?error=access_denied');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/?error=oauth_failed');
    });
  });

  it('redirects to error when token consumption fails', async () => {
    mockConsumeCallbackToken.mockReturnValueOnce(false);
    renderWithSearchParams('?token=bad-token');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/?error=auth_failed');
    });
  });
});
