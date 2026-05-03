import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'testmo_compactMode';

function getInitialValue(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export function useCompactMode(): { compactMode: boolean; toggleCompactMode: () => void } {
  const [compactMode, setCompactMode] = useState<boolean>(getInitialValue);

  useEffect(() => {
    if (compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
  }, [compactMode]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setCompactMode(event.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleCompactMode = useCallback(() => {
    setCompactMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  }, []);

  return { compactMode, toggleCompactMode };
}
