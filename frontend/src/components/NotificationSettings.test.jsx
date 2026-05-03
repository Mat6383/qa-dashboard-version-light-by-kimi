import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationSettings from './NotificationSettings';

const mockShowToast = vi.fn();
const mockMutateAsyncSave = vi.fn();
const mockMutateAsyncTest = vi.fn();
const mockUseQuery = vi.fn();

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../hooks/mutations/useNotifications', () => ({
  useSaveNotificationSettings: () => ({
    mutateAsync: mockMutateAsyncSave,
    isPending: false,
  }),
  useTestNotificationWebhook: () => ({
    mutateAsync: mockMutateAsyncTest,
    isPending: false,
  }),
}));

const mockInvalidate = vi.fn();

vi.mock('../trpc/client', () => ({
  trpc: {
    notifications: {
      settings: {
        useQuery: () => mockUseQuery(),
      },
      saveSettings: {
        useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
      },
    },
    webhooks: {
      list: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
      create: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      update: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      delete: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    useUtils: () => ({
      webhooks: { list: { invalidate: mockInvalidate } },
      notifications: { settings: { invalidate: mockInvalidate } },
    }),
  },
}));

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: { data: null }, isLoading: false, error: null });
  });

  it('renders settings form', async () => {
    render(<NotificationSettings isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Configuration des notifications/i)).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/alerts@neo-logix.local/i)).toBeInTheDocument();
  });

  it('loads existing settings', async () => {
    mockUseQuery.mockReturnValue({
      data: { data: { email: 'admin@test.com', slack_webhook: 'https://slack.test', enabled_sla_email: 1 } },
      isLoading: false,
      error: null,
    });
    render(<NotificationSettings isDark={false} />);
    await waitFor(() => expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument());
  });

  it('saves settings on button click', async () => {
    mockMutateAsyncSave.mockResolvedValue({});
    render(<NotificationSettings isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Sauvegarder/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/alerts@neo-logix.local/i), {
      target: { value: 'new@test.com' },
    });
    fireEvent.click(screen.getByText(/Sauvegarder/i));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Paramètres sauvegardés', 'success'));
  });

  it('tests slack webhook', async () => {
    mockMutateAsyncTest.mockResolvedValue({});
    render(<NotificationSettings isDark={false} />);
    await waitFor(() => expect(screen.getAllByText(/Tester/i).length).toBeGreaterThan(0));

    const slackInput = screen.getAllByPlaceholderText(/hooks.slack.com/i)[0];
    fireEvent.change(slackInput, { target: { value: 'https://hooks.slack.com/test' } });
    fireEvent.click(screen.getAllByText(/Tester/i)[0]);

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Test slack envoyé', 'success'));
  });

  it('shows error toast on save failure', async () => {
    mockMutateAsyncSave.mockRejectedValue(new Error('fail'));
    render(<NotificationSettings isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Sauvegarder/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Sauvegarder/i));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Erreur sauvegarde', 'error'));
  });
});
