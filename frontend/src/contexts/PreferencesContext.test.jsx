import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PreferencesProvider, PreferencesContext } from './PreferencesContext';

const wrapper = ({ children }) => <PreferencesProvider>{children}</PreferencesProvider>;

describe('PreferencesContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults useBusinessTerms to true', () => {
    const { result } = renderHook(() => React.useContext(PreferencesContext), { wrapper });
    expect(result.current.useBusinessTerms).toBe(true);
  });

  it('toggles useBusinessTerms and persists to localStorage', () => {
    const { result } = renderHook(() => React.useContext(PreferencesContext), { wrapper });
    act(() => result.current.setUseBusinessTerms(false));
    expect(result.current.useBusinessTerms).toBe(false);
    expect(localStorage.getItem('testmo_useBusinessTerms')).toBe('false');
  });

  it('restores milestones from localStorage', () => {
    localStorage.setItem('testmo_selectedPreprodMilestones', JSON.stringify([1, 2]));
    localStorage.setItem('testmo_selectedProdMilestones', JSON.stringify([3]));
    const { result } = renderHook(() => React.useContext(PreferencesContext), { wrapper });
    expect(result.current.selectedPreprodMilestones).toEqual([1, 2]);
    expect(result.current.selectedProdMilestones).toEqual([3]);
  });

  it('defaults showProductionSection to true', () => {
    const { result } = renderHook(() => React.useContext(PreferencesContext), { wrapper });
    expect(result.current.showProductionSection).toBe(true);
  });

  it('autoRefresh defaults to true', () => {
    const { result } = renderHook(() => React.useContext(PreferencesContext), { wrapper });
    expect(result.current.autoRefresh).toBe(true);
  });
});
