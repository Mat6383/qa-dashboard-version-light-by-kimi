import { useState, useCallback, useEffect } from 'react';

function getStorageKey(tableId: string): string {
  return `testmo_columns_${tableId}`;
}

function validateOrder(stored: string[] | null, defaultOrder: string[]): boolean {
  if (!stored || !Array.isArray(stored)) return false;
  if (stored.length !== defaultOrder.length) return false;
  const defaultSet = new Set(defaultOrder);
  return stored.every((key) => defaultSet.has(key));
}

function getInitialOrder(tableId: string, defaultOrder: string[]): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(tableId));
    const stored = raw ? JSON.parse(raw) : null;
    if (validateOrder(stored, defaultOrder)) {
      return stored as string[];
    }
  } catch {
    // ignore parse/localStorage errors
  }
  return defaultOrder;
}

export interface UseColumnOrderReturn {
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  resetColumnOrder: () => void;
}

export function useColumnOrder(tableId: string, defaultOrder: string[]): UseColumnOrderReturn {
  const [columnOrder, setColumnOrderState] = useState<string[]>(() =>
    getInitialOrder(tableId, defaultOrder)
  );

  const setColumnOrder = useCallback(
    (order: string[]) => {
      if (validateOrder(order, defaultOrder)) {
        setColumnOrderState(order);
        try {
          localStorage.setItem(getStorageKey(tableId), JSON.stringify(order));
        } catch {
          // ignore localStorage errors
        }
      }
    },
    [tableId, defaultOrder]
  );

  const resetColumnOrder = useCallback(() => {
    setColumnOrderState(defaultOrder);
    try {
      localStorage.removeItem(getStorageKey(tableId));
    } catch {
      // ignore localStorage errors
    }
  }, [tableId, defaultOrder]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getStorageKey(tableId)) {
        const stored = event.newValue ? JSON.parse(event.newValue) : null;
        if (validateOrder(stored, defaultOrder)) {
          setColumnOrderState(stored);
        } else {
          setColumnOrderState(defaultOrder);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [tableId, defaultOrder]);

  return { columnOrder, setColumnOrder, resetColumnOrder };
}
