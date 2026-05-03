import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFeatureFlags, isBetaRollout } from './useFeatureFlags';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../services/api.service', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
  },
  apiClient: {
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
  },
}));

describe('useFeatureFlags', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
  });

  it('récupère tous les flags', async () => {
    mockGet.mockResolvedValue({ data: { data: { annualTrendsV2: true, crosstestBulkEdit: false } } });
    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.flags).toEqual({ annualTrendsV2: true, crosstestBulkEdit: false });
    expect(result.current.rolloutPercentage).toBeNull();
  });

  it('récupère un flag spécifique avec rolloutPercentage', async () => {
    mockGet.mockResolvedValue({
      data: { data: { key: 'annualTrendsV2', enabled: true, rolloutPercentage: 50 } },
    });
    const { result } = renderHook(() => useFeatureFlags('annualTrendsV2'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.flags).toBe(true);
    expect(result.current.rolloutPercentage).toBe(50);
  });

  it('passe userId en query param pour rollout sticky', async () => {
    mockGet.mockResolvedValue({ data: { data: { annualTrendsV2: true } } });
    const { result } = renderHook(() => useFeatureFlags(null, 'user-123'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith('/feature-flags', { params: { userId: 'user-123' } });
  });

  it('toggle met à jour un flag', async () => {
    mockGet.mockResolvedValue({ data: { data: { annualTrendsV2: false } } });
    mockPut.mockResolvedValue({});

    const { result } = renderHook(() => useFeatureFlags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggle('annualTrendsV2', true);
    });
    expect(mockPut).toHaveBeenCalledWith('/feature-flags/annualTrendsV2', { enabled: true });
    await waitFor(() => expect(result.current.flags.annualTrendsV2).toBe(true));
  });

  describe('isBetaRollout', () => {
    it('retourne true pour un rollout partiel', () => {
      expect(isBetaRollout(50)).toBe(true);
      expect(isBetaRollout(1)).toBe(true);
      expect(isBetaRollout(99)).toBe(true);
    });

    it('retourne false pour 0, 100 ou null', () => {
      expect(isBetaRollout(0)).toBe(false);
      expect(isBetaRollout(100)).toBe(false);
      expect(isBetaRollout(null)).toBe(false);
    });
  });
});
