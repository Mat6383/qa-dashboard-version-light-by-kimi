import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToast } from './useToast';
import { ToastProvider } from '../contexts/ToastContext';

describe('useToast', () => {
  it('retourne le contexte dans ToastProvider', () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });
    expect(result.current.showToast).toBeDefined();
  });

  it('throw si utilisé hors ToastProvider', () => {
    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within ToastProvider');
  });
});
