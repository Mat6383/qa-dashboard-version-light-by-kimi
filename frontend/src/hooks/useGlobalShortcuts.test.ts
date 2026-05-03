import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from './useGlobalShortcuts';

describe('useGlobalShortcuts', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onSave: ReturnType<typeof vi.fn>;
  let onHelp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onSave = vi.fn();
    onHelp = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Escape calls onClose', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+S calls onSave and prevents default', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('Ctrl+S does NOT call onSave when input is focused', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    window.dispatchEvent(event);

    expect(onSave).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('? calls onHelp when not typing', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const event = new KeyboardEvent('keydown', { key: '?' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(onHelp).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('? does NOT call onHelp when input is focused', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: '?' });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    window.dispatchEvent(event);

    expect(onHelp).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
