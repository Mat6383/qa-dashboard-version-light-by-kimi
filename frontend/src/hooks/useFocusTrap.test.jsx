import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useFocusTrap } from './useFocusTrap';

function TestModal({ isOpen, onClose }) {
  const ref = useFocusTrap(isOpen);
  if (!isOpen) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button data-modal-close onClick={onClose}>Close</button>
      <input type="text" placeholder="Name" />
      <button>Save</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses first element when opened', () => {
    render(<TestModal isOpen={true} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByText('Close'));
  });

  it('cycles focus back to first element on tab from last', () => {
    render(<TestModal isOpen={true} onClose={vi.fn()} />);
    const saveBtn = screen.getByText('Save');
    saveBtn.focus();
    fireEvent.keyDown(saveBtn, { key: 'Tab' });
    // After tabbing from last element, focus should wrap to first
    expect(document.activeElement).toBe(screen.getByText('Close'));
  });

  it('calls close on Escape key', () => {
    const onClose = vi.fn();
    render(<TestModal isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
