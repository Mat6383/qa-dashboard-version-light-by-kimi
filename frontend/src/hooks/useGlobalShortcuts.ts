import { useEffect, useCallback } from 'react';

interface UseGlobalShortcutsOptions {
  onClose?: () => void;
  onSave?: () => void;
  onHelp?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    target.isContentEditable
  );
}

export function useGlobalShortcuts({ onClose, onSave, onHelp }: UseGlobalShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, ctrlKey, metaKey, target } = event;

      if (key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      const isModS = (ctrlKey || metaKey) && key.toLowerCase() === 's';
      if (isModS && onSave) {
        if (!isTypingTarget(target)) {
          event.preventDefault();
          onSave();
        }
        return;
      }

      if (key === '?' && onHelp) {
        if (!isTypingTarget(target)) {
          event.preventDefault();
          onHelp();
        }
        return;
      }
    },
    [onClose, onSave, onHelp]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
