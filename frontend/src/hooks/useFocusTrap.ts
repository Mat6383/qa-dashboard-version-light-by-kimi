import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export function useFocusTrap(isActive) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    // Focus le premier élément focusable
    first?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        const closeBtn = container.querySelector('[data-modal-close]');
        closeBtn?.click();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('keydown', handleEscape);
      previouslyFocused.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}
