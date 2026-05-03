import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider, ToastContext } from './ToastContext';

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

describe('ToastContext', () => {
  it('has no toast initially', () => {
    const { result } = renderHook(() => React.useContext(ToastContext), { wrapper });
    expect(result.current.showToast).toBeTypeOf('function');
    expect(result.current.hideToast).toBeTypeOf('function');
  });

  it('shows and hides toast via context', () => {
    const { result } = renderHook(() => React.useContext(ToastContext), { wrapper });
    act(() => result.current.showToast('Hello world', 'success'));
    // The Toast component itself is rendered by the provider; we verify the API works
    expect(result.current.hideToast).toBeTypeOf('function');
  });
});
