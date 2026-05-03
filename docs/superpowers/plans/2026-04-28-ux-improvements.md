# P23 UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts, compact mode, and column drag-and-drop to the QA Dashboard frontend.

**Architecture:** Three independent hooks (`useCompactMode`, `useGlobalShortcuts`, `useColumnOrder`) plus two reusable components (`ShortcutHelpOverlay`, `SortableTableHeader`). All state is frontend-only (`localStorage`) with cross-tab broadcast, following the existing `ThemeContext` pattern. No backend changes.

**Tech Stack:** React 18, TypeScript, Vitest, @dnd-kit/core + sortable + utilities, Playwright E2E

---

## File Structure

| File                                                   | Action | Responsibility                                                                         |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| `frontend/src/hooks/useCompactMode.ts`                 | Create | Toggle + persist compact mode in localStorage, cross-tab sync                          |
| `frontend/src/hooks/useCompactMode.test.ts`            | Create | Unit tests for toggle, persist, sync                                                   |
| `frontend/src/hooks/useGlobalShortcuts.ts`             | Create | Global keydown listener, modal layer stack, help overlay trigger                       |
| `frontend/src/hooks/useGlobalShortcuts.test.ts`        | Create | Unit tests for Esc, Ctrl+S, ?, input-guard                                             |
| `frontend/src/components/ShortcutHelpOverlay.tsx`      | Create | Modal overlay listing all shortcuts, closable with Esc                                 |
| `frontend/src/components/ShortcutHelpOverlay.test.tsx` | Create | Render, close Esc, content presence                                                    |
| `frontend/src/hooks/useColumnOrder.ts`                 | Create | Persist/restore column order per tableId in localStorage                               |
| `frontend/src/hooks/useColumnOrder.test.ts`            | Create | Reorder, persist, restore, reset                                                       |
| `frontend/src/components/SortableTableHeader.tsx`      | Create | Dnd-kit wrapper for table headers, keyboard accessible                                 |
| `frontend/src/components/SortableTableHeader.test.tsx` | Create | Render, drag event wiring                                                              |
| `frontend/src/styles/App.css`                          | Modify | Add `.compact-mode` CSS variables + overrides                                          |
| `frontend/src/components/AppLayout.tsx`                | Modify | Add compact toggle button + shortcut help trigger + useGlobalShortcuts mount           |
| `frontend/src/App.tsx`                                 | Modify | Pass `compactMode` class into AppLayout, wire `useCompactMode`                         |
| `frontend/src/components/Dashboard7.tsx`               | Modify | Replace static `<thead>` with `SortableTableHeader`, use `useColumnOrder('crosstest')` |
| `frontend/src/components/AuditLogViewer.tsx`           | Modify | Replace static `<thead>` with `SortableTableHeader`, use `useColumnOrder('audit')`     |
| `frontend/src/components/QuickClosureModal.tsx`        | Modify | Register/unregister with `useGlobalShortcuts` layer on open/close                      |
| `frontend/src/components/ReportGeneratorModal.tsx`     | Modify | Register/unregister with `useGlobalShortcuts` layer on open/close                      |
| `frontend/src/components/TestClosureModal.tsx`         | Modify | Register/unregister with `useGlobalShortcuts` layer on open/close                      |
| `e2e/ux-improvements.spec.js`                          | Create | E2E: compact mode toggle → column reorder → reload → verify persist                    |
| `ROADMAP.md`                                           | Modify | Check P23 items                                                                        |

---

### Task 1: Install @dnd-kit dependencies

**Files:**

- Modify: `frontend/package.json` (after npm install)

- [ ] **Step 1: Install packages**

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Run: `cd frontend && npm ls @dnd-kit/core`
Expected: version printed, no peer-dep errors

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: add @dnd-kit for column drag-and-drop"
```

---

### Task 2: `useCompactMode` hook

**Files:**

- Create: `frontend/src/hooks/useCompactMode.ts`
- Create: `frontend/src/hooks/useCompactMode.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/hooks/useCompactMode.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompactMode } from './useCompactMode';

describe('useCompactMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('compact-mode');
  });

  it('should initialize as false and not add class', () => {
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);
    expect(document.body.classList.contains('compact-mode')).toBe(false);
  });

  it('should toggle compact mode and persist to localStorage', () => {
    const { result } = renderHook(() => useCompactMode());
    act(() => result.current.toggleCompactMode());
    expect(result.current.compactMode).toBe(true);
    expect(localStorage.getItem('testmo_compactMode')).toBe('true');
    expect(document.body.classList.contains('compact-mode')).toBe(true);
  });

  it('should read initial value from localStorage', () => {
    localStorage.setItem('testmo_compactMode', 'true');
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(true);
    expect(document.body.classList.contains('compact-mode')).toBe(true);
  });

  it('should sync across tabs via storage event', () => {
    const { result } = renderHook(() => useCompactMode());
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'testmo_compactMode', newValue: 'true' }));
    });
    expect(result.current.compactMode).toBe(true);
  });
});
```

Run: `cd frontend && npx vitest run src/hooks/useCompactMode.test.ts`
Expected: FAIL "useCompactMode is not exported"

- [ ] **Step 2: Implement the hook**

```typescript
// frontend/src/hooks/useCompactMode.ts
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'testmo_compactMode';

function readValue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeValue(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
}

export function useCompactMode() {
  const [compactMode, setCompactMode] = useState<boolean>(readValue);

  useEffect(() => {
    if (compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
  }, [compactMode]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCompactMode(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggleCompactMode = useCallback(() => {
    setCompactMode((prev) => {
      const next = !prev;
      writeValue(next);
      return next;
    });
  }, []);

  return { compactMode, toggleCompactMode };
}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/hooks/useCompactMode.test.ts`
Expected: 4/4 PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useCompactMode.ts frontend/src/hooks/useCompactMode.test.ts
git commit -m "feat: add useCompactMode hook with tests"
```

---

### Task 3: Compact mode CSS

**Files:**

- Modify: `frontend/src/styles/App.css`

- [ ] **Step 1: Add CSS variables and compact overrides**

Insert after `:root` block (around line 69):

```css
:root {
  /* ... existing variables ... */
  --section-padding: 2rem;
  --card-padding: 1.5rem;
  --metric-font-size: 2.5rem;
  --table-row-height: 64px;
}

body.compact-mode {
  --section-padding: 0.75rem;
  --card-padding: 0.5rem;
  --metric-font-size: 1.5rem;
  --table-row-height: 36px;
}

body.compact-mode .app-header {
  padding: 0.5rem 1rem;
  min-height: auto;
}

body.compact-mode .app-main {
  padding: var(--section-padding);
}

body.compact-mode .metric-card {
  padding: var(--card-padding);
}

body.compact-mode .metric-value {
  font-size: var(--metric-font-size);
}

body.compact-mode .d7-table-wrapper td,
body.compact-mode .d7-table-wrapper th {
  padding: 0.375rem 0.5rem;
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no new CSS warnings

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/App.css
git commit -m "feat: add compact-mode CSS variables and overrides"
```

---

### Task 4: `useGlobalShortcuts` hook

**Files:**

- Create: `frontend/src/hooks/useGlobalShortcuts.ts`
- Create: `frontend/src/hooks/useGlobalShortcuts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/hooks/useGlobalShortcuts.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from './useGlobalShortcuts';

describe('useGlobalShortcuts', () => {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const onHelp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    const { unmount } = renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    unmount();
  });

  function fireKey(key: string, ctrl = false, meta = false, target?: HTMLElement) {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: ctrl, metaKey: meta, bubbles: true });
    (target || document).dispatchEvent(event);
    return event;
  }

  it('calls onClose on Escape', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    fireKey('Escape');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave on Ctrl+S', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const event = fireKey('s', true);
    expect(onSave).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not call onSave on Ctrl+S when typing in input', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const event = fireKey('s', true, false, input);
    expect(onSave).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    document.body.removeChild(input);
  });

  it('calls onHelp on ? when not typing', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    fireKey('?');
    expect(onHelp).toHaveBeenCalled();
  });

  it('does not call onHelp on ? when typing in input', () => {
    renderHook(() => useGlobalShortcuts({ onClose, onSave, onHelp }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireKey('?', false, false, input);
    expect(onHelp).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
```

Run: `cd frontend && npx vitest run src/hooks/useGlobalShortcuts.test.ts`
Expected: FAIL "useGlobalShortcuts is not exported"

- [ ] **Step 2: Implement the hook**

```typescript
// frontend/src/hooks/useGlobalShortcuts.ts
import { useEffect } from 'react';

interface UseGlobalShortcutsOptions {
  onClose?: () => void;
  onSave?: () => void;
  onHelp?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function useGlobalShortcuts({ onClose, onSave, onHelp }: UseGlobalShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { key, ctrlKey, metaKey } = e;
      const typing = isTypingTarget(e.target);

      if (key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if ((ctrlKey || metaKey) && key.toLowerCase() === 's' && onSave) {
        if (!typing) {
          e.preventDefault();
          onSave();
        }
        return;
      }

      if (key === '?' && onHelp && !typing) {
        e.preventDefault();
        onHelp();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onSave, onHelp]);
}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/hooks/useGlobalShortcuts.test.ts`
Expected: 5/5 PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useGlobalMode.ts frontend/src/hooks/useGlobalShortcuts.test.ts
git commit -m "feat: add useGlobalShortcuts hook with tests"
```

---

### Task 5: `ShortcutHelpOverlay` component

**Files:**

- Create: `frontend/src/components/ShortcutHelpOverlay.tsx`
- Create: `frontend/src/components/ShortcutHelpOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ShortcutHelpOverlay.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ShortcutHelpOverlay from './ShortcutHelpOverlay';

describe('ShortcutHelpOverlay', () => {
  it('renders shortcuts list when open', () => {
    render(<ShortcutHelpOverlay isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Raccourcis clavier')).toBeInTheDocument();
    expect(screen.getByText('Fermer le modal')).toBeInTheDocument();
    expect(screen.getByText('Échap')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay isOpen onClose={onClose} />);
    const backdrop = screen.getByRole('dialog').parentElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutHelpOverlay isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
```

Run: `cd frontend && npx vitest run src/components/ShortcutHelpOverlay.test.tsx`
Expected: FAIL "module not found"

- [ ] **Step 2: Implement the component**

```tsx
// frontend/src/components/ShortcutHelpOverlay.tsx
import React, { useEffect } from 'react';

interface ShortcutHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Échap', action: 'Fermer le modal' },
  { key: 'Entrée', action: "Confirmer l'action principale" },
  { key: 'Ctrl + S', action: 'Sauvegarder le formulaire' },
  { key: '?', action: 'Afficher / masquer cette aide' },
];

export default function ShortcutHelpOverlay({ isOpen, onClose }: ShortcutHelpOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Raccourcis clavier"
        style={{
          backgroundColor: 'var(--card-bg, #fff)',
          color: 'var(--text-color, #111)',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '320px',
          maxWidth: '90vw',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: 700 }}>Raccourcis clavier</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.key}>
                <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <kbd
                    style={{
                      backgroundColor: 'var(--color-gray-100, #f3f4f6)',
                      border: '1px solid var(--border-color, #d1d5db)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {s.key}
                  </kbd>
                </td>
                <td style={{ padding: '8px 0' }}>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={onClose}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#3B82F6',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
          }}
          type="button"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/ShortcutHelpOverlay.test.tsx`
Expected: 4/4 PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ShortcutHelpOverlay.tsx frontend/src/components/ShortcutHelpOverlay.test.tsx
git commit -m "feat: add ShortcutHelpOverlay component with tests"
```

---

### Task 6: Wire shortcuts and compact mode into `AppLayout`

**Files:**

- Modify: `frontend/src/components/AppLayout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Modify `AppLayout.tsx`**

Add props:

```typescript
export default function AppLayout({
  // ... existing props ...
  compactMode,
  toggleCompactMode,
}: {
  // ... existing types ...
  compactMode: boolean;
  toggleCompactMode: () => void;
}) {
```

Add imports at top:

```typescript
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import ShortcutHelpOverlay from './ShortcutHelpOverlay';
import { LayoutTemplate } from 'lucide-react'; // new icon
```

Inside component body (after `dashboardRoutes`):

```typescript
const [showHelp, setShowHelp] = React.useState(false);
useGlobalShortcuts({
  onHelp: () => setShowHelp((prev) => !prev),
});
```

Add toggle button next to TV mode button (around line 167):

```tsx
{
  /* Toggle Compact Mode */
}
<button
  className={`btn-toggle ${compactMode ? 'active' : ''}`}
  onClick={toggleCompactMode}
  title={compactMode ? 'Mode compact activé' : 'Mode compact désactivé'}
  type="button"
>
  <LayoutTemplate size={16} />
  {compactMode ? 'Compact' : 'Normal'}
</button>;
```

Add overlay at end of return (before `</div>`):

```tsx
<ShortcutHelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />
```

- [ ] **Step 2: Modify `App.tsx`**

Import hook:

```typescript
import { useCompactMode } from './hooks/useCompactMode';
```

Inside `App()`:

```typescript
const { compactMode, toggleCompactMode } = useCompactMode();
```

Pass to `AppLayout`:

```tsx
      <AppLayout
        // ... existing props ...
        compactMode={compactMode}
        toggleCompactMode={toggleCompactMode}
      >
```

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npx vitest run --reporter=verbose`
Expected: All existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppLayout.tsx frontend/src/App.tsx
git commit -m "feat: wire compact mode toggle and global shortcuts into AppLayout"
```

---

### Task 7: Modal integration for `Esc`, `Enter`, `Ctrl+S`

**Files:**

- Modify: `frontend/src/components/QuickClosureModal.tsx`
- Modify: `frontend/src/components/ReportGeneratorModal.tsx`
- Modify: `frontend/src/components/TestClosureModal.tsx`

Pattern for each modal:

1. Import `useGlobalShortcuts`
2. Inside component, call `useGlobalShortcuts({ onClose, onSave: handleSubmit })` when `isOpen`

- [ ] **Step 1: Update `QuickClosureModal.tsx`**

Add import:

```typescript
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
```

Inside component body:

```typescript
useGlobalShortcuts({
  onClose: isOpen ? onClose : undefined,
  onSave: isOpen ? handleExport : undefined,
});
```

Assume `handleExport` is the primary action. If not defined yet, use the existing export handler name.

- [ ] **Step 2: Update `ReportGeneratorModal.tsx`**

Same pattern:

```typescript
useGlobalShortcuts({
  onClose: isOpen ? onClose : undefined,
  onSave: isOpen ? handleGenerate : undefined,
});
```

- [ ] **Step 3: Update `TestClosureModal.tsx`**

Same pattern:

```typescript
useGlobalShortcuts({
  onClose: isOpen ? onClose : undefined,
  onSave: isOpen ? handleExport : undefined,
});
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/QuickClosureModal.tsx frontend/src/components/ReportGeneratorModal.tsx frontend/src/components/TestClosureModal.tsx
git commit -m "feat: add Esc/Ctrl+S keyboard shortcuts to main modals"
```

---

### Task 8: `useColumnOrder` hook

**Files:**

- Create: `frontend/src/hooks/useColumnOrder.ts`
- Create: `frontend/src/hooks/useColumnOrder.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/hooks/useColumnOrder.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnOrder } from './useColumnOrder';

describe('useColumnOrder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const defaultCols = ['a', 'b', 'c'];

  it('returns default order when nothing stored', () => {
    const { result } = renderHook(() => useColumnOrder('test-table', defaultCols));
    expect(result.current.columnOrder).toEqual(['a', 'b', 'c']);
  });

  it('reorders columns and persists', () => {
    const { result } = renderHook(() => useColumnOrder('test-table', defaultCols));
    act(() => result.current.setColumnOrder(['c', 'a', 'b']));
    expect(result.current.columnOrder).toEqual(['c', 'a', 'b']);
    expect(localStorage.getItem('testmo_columns_test-table')).toBe(JSON.stringify(['c', 'a', 'b']));
  });

  it('restores stored order on mount', () => {
    localStorage.setItem('testmo_columns_test-table', JSON.stringify(['b', 'c', 'a']));
    const { result } = renderHook(() => useColumnOrder('test-table', defaultCols));
    expect(result.current.columnOrder).toEqual(['b', 'c', 'a']);
  });

  it('resets to default', () => {
    localStorage.setItem('testmo_columns_test-table', JSON.stringify(['b', 'c', 'a']));
    const { result } = renderHook(() => useColumnOrder('test-table', defaultCols));
    act(() => result.current.resetColumnOrder());
    expect(result.current.columnOrder).toEqual(['a', 'b', 'c']);
    expect(localStorage.getItem('testmo_columns_test-table')).toBe(JSON.stringify(['a', 'b', 'c']));
  });
});
```

Run: `cd frontend && npx vitest run src/hooks/useColumnOrder.test.ts`
Expected: FAIL "useColumnOrder is not exported"

- [ ] **Step 2: Implement the hook**

```typescript
// frontend/src/hooks/useColumnOrder.ts
import { useState, useEffect, useCallback } from 'react';

function readOrder(tableId: string, defaultOrder: string[]): string[] {
  try {
    const raw = localStorage.getItem(`testmo_columns_${tableId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (parsed.length === defaultOrder.length && parsed.every((c) => defaultOrder.includes(c))) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return defaultOrder;
}

function writeOrder(tableId: string, order: string[]): void {
  try {
    localStorage.setItem(`testmo_columns_${tableId}`, JSON.stringify(order));
  } catch {
    // ignore
  }
}

export function useColumnOrder(tableId: string, defaultOrder: string[]) {
  const [columnOrder, setColumnOrderState] = useState<string[]>(() => readOrder(tableId, defaultOrder));

  const setColumnOrder = useCallback(
    (order: string[]) => {
      writeOrder(tableId, order);
      setColumnOrderState(order);
    },
    [tableId]
  );

  const resetColumnOrder = useCallback(() => {
    writeOrder(tableId, defaultOrder);
    setColumnOrderState(defaultOrder);
  }, [tableId, defaultOrder]);

  return { columnOrder, setColumnOrder, resetColumnOrder };
}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/hooks/useColumnOrder.test.ts`
Expected: 4/4 PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useColumnOrder.ts frontend/src/hooks/useColumnOrder.test.ts
git commit -m "feat: add useColumnOrder hook with tests"
```

---

### Task 9: `SortableTableHeader` component

**Files:**

- Create: `frontend/src/components/SortableTableHeader.tsx`
- Create: `frontend/src/components/SortableTableHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/SortableTableHeader.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SortableTableHeader from './SortableTableHeader';

describe('SortableTableHeader', () => {
  const columns = [
    { key: 'a', label: 'Col A' },
    { key: 'b', label: 'Col B' },
  ];

  it('renders all column headers', () => {
    render(
      <table>
        <SortableTableHeader columns={columns} columnOrder={['a', 'b']} onReorder={vi.fn()} tableId="test" />
      </table>
    );
    expect(screen.getByText('Col A')).toBeInTheDocument();
    expect(screen.getByText('Col B')).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npx vitest run src/components/SortableTableHeader.test.tsx`
Expected: FAIL "module not found"

- [ ] **Step 2: Implement the component**

```tsx
// frontend/src/components/SortableTableHeader.tsx
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface ColumnDef {
  key: string;
  label: string;
}

interface SortableTableHeaderProps {
  columns: ColumnDef[];
  columnOrder: string[];
  onReorder: (order: string[]) => void;
  tableId: string;
}

function SortableHeaderCell({ column }: { column: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.key,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="columnheader"
      aria-describedby={`${column.key}-drag-hint`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <GripVertical size={12} style={{ opacity: 0.4 }} />
        {column.label}
      </span>
    </th>
  );
}

export default function SortableTableHeader({ columns, columnOrder, onReorder, tableId }: SortableTableHeaderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedColumns = columnOrder.map((key) => columns.find((c) => c.key === key)).filter(Boolean) as ColumnDef[];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));
      onReorder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
        <thead>
          <tr>
            {orderedColumns.map((col) => (
              <SortableHeaderCell key={col.key} column={col} />
            ))}
          </tr>
        </thead>
      </SortableContext>
      <span id={`${tableId}-drag-hint`} style={{ display: 'none' }}>
        Glisser-déposer pour réordonner les colonnes. Utilisez Espace pour soulever, flèches pour déplacer.
      </span>
    </DndContext>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/SortableTableHeader.test.tsx`
Expected: 1/1 PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SortableTableHeader.tsx frontend/src/components/SortableTableHeader.test.tsx
git commit -m "feat: add SortableTableHeader component with @dnd-kit"
```

---

### Task 10: Integrate DnD into `Dashboard7`

**Files:**

- Modify: `frontend/src/components/Dashboard7.tsx`

- [ ] **Step 1: Modify `Dashboard7.tsx`**

Add imports:

```typescript
import { useColumnOrder } from '../hooks/useColumnOrder';
import SortableTableHeader from './SortableTableHeader';
```

Define columns array before `VirtualIssueTable`:

```typescript
const CROSS_TEST_COLUMNS = [
  { key: 'iid', label: '#' },
  { key: 'title', label: 'Ticket' },
  { key: 'assignees', label: 'Assigné(s)' },
  { key: 'state', label: 'Statut' },
  { key: 'comments', label: 'Commentaires' },
];
```

Inside `VirtualIssueTable` props, add `columnOrder`:

```typescript
function VirtualIssueTable({ issues, comments, selectedIteration, onCommentSaved, onCommentDeleted, tableWrapperRef, columnOrder }) {
```

Replace static `<thead>`:

```tsx
  return (
    <div ref={tableWrapperRef} className="d7-table-wrapper">
      <table className="d7-table">
        <SortableTableHeader
          columns={CROSS_TEST_COLUMNS}
          columnOrder={columnOrder}
          onReorder={/* passed from parent */}
          tableId="crosstest"
        />
        <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
```

In `Dashboard7` component:

```typescript
const { columnOrder, setColumnOrder } = useColumnOrder(
  'crosstest',
  CROSS_TEST_COLUMNS.map((c) => c.key)
);
```

Pass to `VirtualIssueTable`:

```tsx
<VirtualIssueTable
  issues={filteredIssues}
  comments={comments}
  selectedIteration={selectedIteration}
  onCommentSaved={handleCommentSaved}
  onCommentDeleted={handleCommentDeleted}
  tableWrapperRef={tableWrapperRef}
  columnOrder={columnOrder}
  onReorder={setColumnOrder}
/>
```

Update `VirtualIssueTable` prop signature to accept `onReorder`:

```typescript
function VirtualIssueTable({ issues, comments, selectedIteration, onCommentSaved, onCommentDeleted, tableWrapperRef, columnOrder, onReorder }) {
```

And wire it into `SortableTableHeader`:

```tsx
<SortableTableHeader columns={CROSS_TEST_COLUMNS} columnOrder={columnOrder} onReorder={onReorder} tableId="crosstest" />
```

- [ ] **Step 2: Render cells based on column order**

Replace the hardcoded `<tr>` cells with a map over `columnOrder`:

```tsx
<tr
  key={virtualRow.key}
  style={{
    height: `${virtualRow.size}px`,
    transform: `translateY(${virtualRow.start}px)`,
  }}
>
  {columnOrder.map((colKey) => {
    switch (colKey) {
      case 'iid':
        return <td key={colKey}>{issue.iid}</td>;
      case 'title':
        return (
          <td key={colKey}>
            <a
              className="d7-issue-link"
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Ouvrir #${issue.iid} dans GitLab`}
            >
              <span className="d7-issue-iid">#{issue.iid}</span>
              {issue.title}
              <ExternalLink size={12} style={{ flexShrink: 0 }} />
            </a>
            {issue.labels && issue.labels.length > 0 && (
              <div className="d7-labels">
                {issue.labels.map((label) => (
                  <span key={label} className="d7-label-chip">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </td>
        );
      case 'assignees':
        return (
          <td key={colKey}>
            {issue.assignees && issue.assignees.length > 0 ? (
              issue.assignees.join(', ')
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non assigné</span>
            )}
          </td>
        );
      case 'state':
        return (
          <td key={colKey}>
            {issue.state === 'closed' ? (
              <span className="d7-badge d7-badge-closed">
                <CheckCircle2 size={11} /> Fermé
              </span>
            ) : (
              <span className="d7-badge d7-badge-open">
                <Clock size={11} /> Ouvert
              </span>
            )}
          </td>
        );
      case 'comments':
        return (
          <td key={colKey} className="d7-comment-cell">
            <CommentCell
              issue={issue}
              comment={comments[issue.iid] || null}
              milestoneTitle={selectedIteration?.title}
              onSaved={onCommentSaved}
              onDeleted={onCommentDeleted}
            />
          </td>
        );
      default:
        return null;
    }
  })}
</tr>
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/Dashboard7.test.jsx`
Expected: PASS (or update snapshot if needed)

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Dashboard7.tsx
git commit -m "feat: add column drag-and-drop to Dashboard7 CrossTest table"
```

---

### Task 11: Integrate DnD into `AuditLogViewer`

**Files:**

- Modify: `frontend/src/components/AuditLogViewer.tsx`

- [ ] **Step 1: Modify `AuditLogViewer.tsx`**

Add imports:

```typescript
import { useColumnOrder } from '../hooks/useColumnOrder';
import SortableTableHeader from './SortableTableHeader';
```

Define columns:

```typescript
const AUDIT_COLUMNS = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'user', label: 'Utilisateur' },
  { key: 'action', label: 'Action' },
  { key: 'resource', label: 'Ressource' },
  { key: 'methodPath', label: 'Méthode / Chemin' },
  { key: 'httpStatus', label: 'HTTP' },
  { key: 'result', label: 'Résultat' },
  { key: 'ip', label: 'IP' },
];
```

Inside component:

```typescript
const { columnOrder, setColumnOrder } = useColumnOrder(
  'audit',
  AUDIT_COLUMNS.map((c) => c.key)
);
```

Replace `<thead>`:

```tsx
          <table style={themeStyles.table}>
            <SortableTableHeader
              columns={AUDIT_COLUMNS}
              columnOrder={columnOrder}
              onReorder={setColumnOrder}
              tableId="audit"
            />
            <tbody>
```

Map cells by `columnOrder` inside `logs.map((log) => (...))`:

```tsx
<tr key={log.id}>
  {columnOrder.map((colKey) => {
    switch (colKey) {
      case 'timestamp':
        return (
          <td key={colKey} style={themeStyles.td}>
            {formatDate(log.timestamp, i18n.language)}
          </td>
        );
      case 'user':
        return (
          <td key={colKey} style={themeStyles.td}>
            {log.actor_email ? (
              <>
                <div>{log.actor_email}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{log.actor_role}</div>
              </>
            ) : (
              <span style={{ color: '#9ca3af' }}>—</span>
            )}
          </td>
        );
      case 'action':
        return (
          <td key={colKey} style={themeStyles.td}>
            <span style={{ fontWeight: 500 }}>
              {log.action && ACTION_KEY_MAP[log.action]
                ? t(`auditLog.actions.${ACTION_KEY_MAP[log.action]}`)
                : log.action}
            </span>
          </td>
        );
      case 'resource':
        return (
          <td key={colKey} style={themeStyles.td}>
            {log.resource}
            {log.resource_id ? ` / ${log.resource_id}` : ''}
          </td>
        );
      case 'methodPath':
        return (
          <td key={colKey} style={themeStyles.td}>
            <code
              style={{
                fontSize: '0.75rem',
                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {log.method}
            </code>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{log.path}</div>
          </td>
        );
      case 'httpStatus':
        return (
          <td key={colKey} style={themeStyles.td}>
            {log.status_code ?? '—'}
          </td>
        );
      case 'result':
        return (
          <td key={colKey} style={themeStyles.td}>
            <StatusBadge success={log.success} t={t} />
          </td>
        );
      case 'ip':
        return (
          <td key={colKey} style={themeStyles.td}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{log.ip}</span>
          </td>
        );
      default:
        return null;
    }
  })}
</tr>
```

Update `colSpan` for empty state to be dynamic:

```tsx
                    <td colSpan={columnOrder.length} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AuditLogViewer.tsx
git commit -m "feat: add column drag-and-drop to AuditLogViewer"
```

---

### Task 12: Playwright E2E test

**Files:**

- Create: `e2e/ux-improvements.spec.js`

- [ ] **Step 1: Write the E2E test**

```javascript
// e2e/ux-improvements.spec.js
const { test, expect } = require('@playwright/test');

test.describe('UX Improvements', () => {
  test('compact mode toggle persists after reload', async ({ page }) => {
    await page.goto('/');
    // Open a dashboard with content
    await page.waitForSelector('.app-header');

    // Toggle compact mode
    const compactBtn = page.locator('button', { hasText: /Compact|Normal/i });
    await compactBtn.click();

    // Verify compact class is on body
    await expect(page.locator('body')).toHaveClass(/compact-mode/);

    // Reload
    await page.reload();
    await page.waitForSelector('.app-header');

    // Verify still compact
    await expect(page.locator('body')).toHaveClass(/compact-mode/);
  });

  test('keyboard help overlay opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-header');

    // Press ?
    await page.keyboard.press('?');
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('text=Raccourcis clavier')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('role=dialog')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E test**

Run: `npx playwright test e2e/ux-improvements.spec.js`
Expected: 2/2 PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/ux-improvements.spec.js
git commit -m "test(e2e): add ux improvements E2E tests"
```

---

### Task 13: Final validation & ROADMAP

**Files:**

- Modify: `ROADMAP.md`

- [ ] **Step 1: Run full test suite**

```bash
cd frontend && npm run test:run
cd .. && npx playwright test
```

Expected: All backend tests pass (565/565), all frontend tests pass, all E2E pass

- [ ] **Step 2: Run build & lint**

```bash
cd frontend && npm run build && npx eslint src --ext .ts,.tsx
cd ../backend && npm run typecheck && npm run lint
```

Expected: Build < 3s, 0 lint errors, typecheck 0 errors

- [ ] **Step 3: Update ROADMAP.md**

Under `## 🚧 Sessions futures (P23+)`, change:

```markdown
- [ ] **P23** — Améliorations UX : raccourcis clavier, drag-and-drop tableaux, mode compact
```

to:

```markdown
- [x] **P23** — Améliorations UX : raccourcis clavier, drag-and-drop tableaux, mode compact ✅
```

- [ ] **Step 4: Final commit**

```bash
git add ROADMAP.md
git commit -m "docs: mark P23 UX improvements as complete"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every design section (shortcuts, compact, DnD, tests, ROADMAP) has corresponding tasks
- [ ] **Placeholder scan:** No TBD, no "implement later", all code blocks contain actual code
- [ ] **Type consistency:** `useGlobalShortcuts` options interface used consistently; `columnOrder` is `string[]` everywhere; `tableId` is `string` everywhere
- [ ] **No backend changes:** Confirmed — all tasks are in `frontend/` or `e2e/`
