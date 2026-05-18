/**
 * ================================================
 * USE DASHBOARD LAYOUT — Hook de layout personnalisable
 * ================================================
 * Drag & drop layout persistence via localStorage.
 * Option C "Pro Suite" — Widgets personnalisables.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';

export type WidgetId =
  | 'completionRate'
  | 'passRate'
  | 'failureRate'
  | 'testEfficiency'
  | 'escapeRate'
  | 'detectionRate';

export type SectionType = 'preprod' | 'production';

export interface DashboardLayout {
  preprod: WidgetId[];
  production: WidgetId[];
}

const DEFAULT_LAYOUT: DashboardLayout = {
  preprod: ['completionRate', 'passRate', 'failureRate', 'testEfficiency'],
  production: ['escapeRate', 'detectionRate'],
};

const STORAGE_KEY = 'testmo_dashboardLayout_v1';

function loadLayout(): DashboardLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate structure
      if (
        Array.isArray(parsed.preprod) &&
        Array.isArray(parsed.production) &&
        parsed.preprod.every((id: string) => DEFAULT_LAYOUT.preprod.includes(id as WidgetId)) &&
        parsed.production.every((id: string) => DEFAULT_LAYOUT.production.includes(id as WidgetId)) &&
        parsed.preprod.length === DEFAULT_LAYOUT.preprod.length &&
        parsed.production.length === DEFAULT_LAYOUT.production.length
      ) {
        return parsed as DashboardLayout;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: DashboardLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (err) {
    console.warn('localStorage quota exceeded:', err);
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setLayout(loadLayout());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const moveWidget = useCallback(
    (section: SectionType, oldIndex: number, newIndex: number) => {
      setLayout((prev) => {
        const items = [...prev[section]];
        const [moved] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, moved);
        return { ...prev, [section]: items };
      });
    },
    []
  );

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  return { layout, moveWidget, resetLayout };
}
