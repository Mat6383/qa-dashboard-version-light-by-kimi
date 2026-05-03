# UI Color Harmonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complète de la palette graphique vers GitHub Dark theme avec tokens CSS unifiés et logique de seuils centralisée sur tous les dashboards.

**Architecture:** Remplacer les couleurs en dur par des tokens CSS sémantiques (`--status-success`, `--surface-canvas`, etc.) dans `tokens.css` et `App.css`. Centraliser la logique de couleur par seuil dans `frontend/src/lib/colors.ts`. Mettre à jour tous les composants pour consommer les tokens et l'utility.

**Tech Stack:** React, plain CSS, CSS custom properties, TypeScript, Vitest.

---

## Task 1: Update CSS Tokens (`tokens.css`)

**Files:**

- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: Replace the entire `:root` block with new light theme tokens**

Replace the existing `:root` (lines ~1-120) with:

```css
:root {
  /* ─── Surfaces ─── */
  --surface-canvas: #f6f8fa;
  --surface-default: #ffffff;
  --surface-elevated: #ffffff;
  --surface-muted: #f3f4f6;
  --surface-hover: #f3f4f6;
  --surface-active: #e5e7eb;

  /* ─── Text ─── */
  --text-default: #1f2328;
  --text-secondary: #57606a;
  --text-muted: #8c959f;
  --text-inverse: #ffffff;
  --text-link: #06b6d4;
  --text-link-hover: #0891b2;

  /* ─── Borders ─── */
  --border-color: #d0d7de;
  --border-subtle: #e5e7eb;
  --border-focus: rgba(6, 182, 212, 0.4);

  /* ─── Accents ─── */
  --accent-primary: #06b6d4;
  --accent-primary-hover: #0891b2;
  --accent-primary-pressed: #0e7490;
  --accent-primary-bg: rgba(6, 182, 212, 0.1);
  --accent-secondary: #7c3aed;
  --accent-secondary-hover: #6d28d9;

  /* ─── Status ─── */
  --status-success: #16a34a;
  --status-success-bg: #dcfce7;
  --status-success-border: #86efac;
  --status-warning: #d97706;
  --status-warning-bg: #fef3c7;
  --status-warning-border: #fcd34d;
  --status-danger: #dc2626;
  --status-danger-bg: #fee2e2;
  --status-danger-border: #fca5a5;
  --status-info: #2563eb;
  --status-info-bg: #dbeafe;
  --status-info-border: #93c5fd;

  /* ─── Shadows ─── */
  --shadow-sm: 0 1px 2px rgba(31, 35, 40, 0.04);
  --shadow-md: 0 3px 6px rgba(31, 35, 40, 0.08);
  --shadow-lg: 0 8px 24px rgba(31, 35, 40, 0.12);
  --shadow-xl: 0 12px 48px rgba(31, 35, 40, 0.16);

  /* ─── Radius ─── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* ─── Typography ─── */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --font-mono: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace;

  /* ─── Focus ─── */
  --focus-ring: 0 0 0 3px var(--border-focus);

  /* ─── Legacy aliases (kept for compatibility during migration) ─── */
  --color-primary: var(--accent-primary);
  --color-success: var(--status-success);
  --color-warning: var(--status-warning);
  --color-danger: var(--status-danger);
  --bg-color: var(--surface-canvas);
  --text-color: var(--text-default);
  --header-bg: var(--surface-default);
  --card-bg: var(--surface-default);
}
```

- [ ] **Step 2: Replace the `.app.dark-theme` block with new dark theme tokens**

Replace the existing `.app.dark-theme, .dark-theme` block with:

```css
.app.dark-theme,
.dark-theme {
  /* ─── Surfaces ─── */
  --surface-canvas: #0a0a0a;
  --surface-default: #111111;
  --surface-elevated: #161b22;
  --surface-muted: #0d1117;
  --surface-hover: #1c2128;
  --surface-active: #21262d;

  /* ─── Text ─── */
  --text-default: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --text-inverse: #0a0a0a;
  --text-link: #22d3ee;
  --text-link-hover: #67e8f9;

  /* ─── Borders ─── */
  --border-color: #21262d;
  --border-subtle: #30363d;
  --border-focus: rgba(34, 211, 238, 0.35);

  /* ─── Accents ─── */
  --accent-primary: #22d3ee;
  --accent-primary-hover: #67e8f9;
  --accent-primary-pressed: #a5f3fc;
  --accent-primary-bg: rgba(34, 211, 238, 0.1);
  --accent-secondary: #a78bfa;
  --accent-secondary-hover: #c4b5fd;

  /* ─── Status ─── */
  --status-success: #4ade80;
  --status-success-bg: #14532d;
  --status-success-border: #22c55e;
  --status-warning: #fbbf24;
  --status-warning-bg: #78350f;
  --status-warning-border: #f59e0b;
  --status-danger: #f87171;
  --status-danger-bg: #7f1d1d;
  --status-danger-border: #ef4444;
  --status-info: #60a5fa;
  --status-info-bg: #1e3a8a;
  --status-info-border: #3b82f6;

  /* ─── Shadows ─── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 3px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 12px 48px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat(tokens): implement github dark color palette"
```

---

## Task 2: Update Legacy CSS (`App.css`)

**Files:**

- Modify: `frontend/src/styles/App.css`

- [ ] **Step 1: Update the `:root` block in App.css to use tokens instead of hardcoded values**

Find the `:root` block (around line 1-30) and replace it with:

```css
:root {
  --color-primary: var(--accent-primary);
  --color-success: var(--status-success);
  --color-warning: var(--status-warning);
  --color-danger: var(--status-danger);

  --bg-color: var(--surface-canvas);
  --text-color: var(--text-default);
  --header-bg: var(--surface-default);
  --card-bg: var(--surface-default);
  --border-color: var(--border-color);
}
```

- [ ] **Step 2: Update `.app.dark-theme` block in App.css**

Find `.app.dark-theme` block and replace with:

```css
.app.dark-theme {
  --bg-color: var(--surface-canvas);
  --text-color: var(--text-default);
  --header-bg: var(--surface-default);
  --card-bg: var(--surface-default);
  --border-color: var(--border-color);
}
```

- [ ] **Step 3: Scan for any remaining hardcoded hex colors in App.css and replace with tokens**

Run grep to find hardcoded colors:

```bash
grep -nE '#[0-9a-fA-F]{3,6}' frontend/src/styles/App.css
```

For each match, replace with appropriate token (`var(--status-success)`, `var(--text-default)`, etc.). Common replacements:

- `#10b981` / `#059669` → `var(--status-success)`
- `#f59e0b` / `#d97706` → `var(--status-warning)`
- `#ef4444` / `#dc2626` → `var(--status-danger)`
- `#2563eb` / `#3b82f6` → `var(--accent-primary)`
- `#0f172a` / `#1e293b` → `var(--surface-default)` or `var(--surface-elevated)`
- `#ffffff` → `var(--surface-default)`
- `#f8fafc` → `var(--surface-canvas)`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/App.css
git commit -m "feat(css): migrate App.css to semantic tokens"
```

---

## Task 3: Create Color Utility (`colors.ts`)

**Files:**

- Create: `frontend/src/lib/colors.ts`
- Create: `frontend/src/lib/colors.test.ts`

- [ ] **Step 1: Write the utility with threshold configuration**

```typescript
// frontend/src/lib/colors.ts

export type MetricLevel = 'success' | 'warning' | 'danger';

export interface MetricThreshold {
  target: number;
  warning: number;
  inverse?: boolean; // true when lower is better (failure rate, escape rate)
}

export const METRIC_THRESHOLDS: Record<string, MetricThreshold> = {
  completionRate: { target: 90, warning: 80 },
  passRate: { target: 95, warning: 85 },
  failureRate: { target: 5, warning: 10, inverse: true },
  testEfficiency: { target: 95, warning: 85 },
  escapeRate: { target: 5, warning: 10, inverse: true },
  detectionRate: { target: 95, warning: 85 },
  blockedRate: { target: 5, warning: 10, inverse: true },
};

export function getMetricLevel(metricName: keyof typeof METRIC_THRESHOLDS, value: number): MetricLevel {
  const config = METRIC_THRESHOLDS[metricName];
  if (!config) return 'warning';

  const { target, warning, inverse } = config;

  if (inverse) {
    if (value <= target) return 'success';
    if (value <= warning) return 'warning';
    return 'danger';
  }

  if (value >= target) return 'success';
  if (value >= warning) return 'warning';
  return 'danger';
}

export function getMetricColor(metricName: keyof typeof METRIC_THRESHOLDS, value: number): string {
  const level = getMetricLevel(metricName, value);
  switch (level) {
    case 'success':
      return 'var(--status-success)';
    case 'warning':
      return 'var(--status-warning)';
    case 'danger':
      return 'var(--status-danger)';
  }
}

export function getMetricBgColor(metricName: keyof typeof METRIC_THRESHOLDS, value: number): string {
  const level = getMetricLevel(metricName, value);
  switch (level) {
    case 'success':
      return 'var(--status-success-bg)';
    case 'warning':
      return 'var(--status-warning-bg)';
    case 'danger':
      return 'var(--status-danger-bg)';
  }
}

export function getMetricBorderColor(metricName: keyof typeof METRIC_THRESHOLDS, value: number): string {
  const level = getMetricLevel(metricName, value);
  switch (level) {
    case 'success':
      return 'var(--status-success-border)';
    case 'warning':
      return 'var(--status-warning-border)';
    case 'danger':
      return 'var(--status-danger-border)';
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// frontend/src/lib/colors.test.ts
import { describe, it, expect } from 'vitest';
import { getMetricLevel, getMetricColor, METRIC_THRESHOLDS } from './colors';

describe('getMetricLevel', () => {
  it('returns success for passRate >= target', () => {
    expect(getMetricLevel('passRate', 95)).toBe('success');
    expect(getMetricLevel('passRate', 100)).toBe('success');
  });

  it('returns warning for passRate in window', () => {
    expect(getMetricLevel('passRate', 90)).toBe('warning');
    expect(getMetricLevel('passRate', 85)).toBe('warning');
  });

  it('returns danger for passRate below warning', () => {
    expect(getMetricLevel('passRate', 84)).toBe('danger');
    expect(getMetricLevel('passRate', 0)).toBe('danger');
  });

  it('returns success for inverse metric (failureRate) <= target', () => {
    expect(getMetricLevel('failureRate', 5)).toBe('success');
    expect(getMetricLevel('failureRate', 0)).toBe('success');
  });

  it('returns warning for inverse metric in window', () => {
    expect(getMetricLevel('failureRate', 8)).toBe('warning');
    expect(getMetricLevel('failureRate', 10)).toBe('warning');
  });

  it('returns danger for inverse metric above warning', () => {
    expect(getMetricLevel('failureRate', 11)).toBe('danger');
    expect(getMetricLevel('failureRate', 50)).toBe('danger');
  });
});

describe('getMetricColor', () => {
  it('returns correct CSS variable for passRate', () => {
    expect(getMetricColor('passRate', 95)).toBe('var(--status-success)');
    expect(getMetricColor('passRate', 85)).toBe('var(--status-warning)');
    expect(getMetricColor('passRate', 80)).toBe('var(--status-danger)');
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd "/Users/matou/Kimi code - Workspace/QA-dashboard by kimi 2.0/frontend" && npx vitest run src/lib/colors.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/colors.ts frontend/src/lib/colors.test.ts
git commit -m "feat(colors): add centralized metric color utility with thresholds"
```

---

## Task 4: Update Core Dashboard Components

**Files:**

- Modify: `frontend/src/components/PreprodSection.tsx`
- Modify: `frontend/src/components/ProductionSection.tsx`
- Modify: `frontend/src/components/MetricsCards.tsx`
- Modify: `frontend/src/components/MetricCard.tsx`

- [ ] **Step 1: Update `PreprodSection.tsx` to use `getMetricColor`**

Replace the existing inline color logic (lines ~68-119) with:

```tsx
import { getMetricColor, getMetricBgColor } from '../lib/colors';

// In the JSX, replace each inline color with:
// Completion Rate
color={getMetricColor('completionRate', d1.completionRate)}

// Pass Rate
color={getMetricColor('passRate', d1.passRate)}

// Failure Rate
color={getMetricColor('failureRate', d1.failureRate)}

// Test Efficiency
color={getMetricColor('testEfficiency', d1.testEfficiency)}
```

Also update `getPassRateColor()` to:

```tsx
export function getPassRateColor(passRate: number): string {
  return getMetricColor('passRate', passRate);
}
```

- [ ] **Step 2: Update `ProductionSection.tsx`**

Replace the boolean-based styling with threshold-based colors:

```tsx
import { getMetricColor, getMetricBgColor, getMetricBorderColor } from '../lib/colors';

// Escape Rate card styling:
const escapeColor = getMetricColor('escapeRate', rates.escapeRate);
const escapeBg = getMetricBgColor('escapeRate', rates.escapeRate);
const escapeBorder = getMetricBorderColor('escapeRate', rates.escapeRate);

// Detection Rate card styling:
const ddpColor = getMetricColor('detectionRate', rates.detectionRate);
const ddpBg = getMetricBgColor('detectionRate', rates.detectionRate);
const ddpBorder = getMetricBorderColor('detectionRate', rates.detectionRate);
```

Replace class-based success/danger with inline styles using these variables.

- [ ] **Step 3: Update `MetricsCards.tsx`**

Replace `getColorByThreshold` and `getColorForFailure` with:

```tsx
import { getMetricColor } from '../lib/colors';

// Usage:
color: getMetricColor('completionRate', metrics.completionRate),
color: getMetricColor('passRate', metrics.passRate),
color: getMetricColor('failureRate', metrics.failureRate),
color: getMetricColor('testEfficiency', metrics.testEfficiency),
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PreprodSection.tsx frontend/src/components/ProductionSection.tsx frontend/src/components/MetricsCards.tsx frontend/src/components/MetricCard.tsx
git commit -m "feat(components): apply threshold colors to core dashboard sections"
```

---

## Task 5: Update Secondary Dashboards

**Files:**

- Modify: `frontend/src/components/Dashboard5.tsx`
- Modify: `frontend/src/components/TvDashboard.tsx`
- Modify: `frontend/src/components/MultiProjectDashboard.tsx`
- Modify: `frontend/src/components/CompareDashboard.tsx`

- [ ] **Step 1: Update `Dashboard5.tsx` escape rate badges**

Replace inline style logic with `getMetricColor` and `getMetricBgColor`.

- [ ] **Step 2: Update `TvDashboard.tsx` KPI colors**

Replace inline class logic with `getMetricColor` calls for pass rate, block rate, etc.

- [ ] **Step 3: Update `MultiProjectDashboard.tsx`**

Replace `getPassRateClass`, `getBlockedRateClass`, `getCompletionRateClass` with:

```tsx
import { getMetricColor } from '../lib/colors';

function getPassRateColor(value: number | null) {
  if (value === null) return '';
  return getMetricColor('passRate', value);
}

function getBlockedRateColor(value: number | null) {
  if (value === null) return '';
  return getMetricColor('blockedRate', value);
}

function getCompletionRateColor(value: number | null) {
  if (value === null) return '';
  return getMetricColor('completionRate', value);
}
```

Update CSS classes in `MultiProjectDashboard.css` to use these colors instead of hardcoded classes.

- [ ] **Step 4: Update `CompareDashboard.tsx`**

Apply `getMetricColor` for radar chart colors and metric displays.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard5.tsx frontend/src/components/TvDashboard.tsx frontend/src/components/MultiProjectDashboard.tsx frontend/src/components/CompareDashboard.tsx frontend/src/styles/MultiProjectDashboard.css
git commit -m "feat(dashboards): harmonize colors on secondary dashboards"
```

---

## Task 6: Charts & Global Components

**Files:**

- Modify: `frontend/src/components/StatusChart.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`
- Modify: `frontend/src/components/AppRouter.tsx`

- [ ] **Step 1: Update `StatusChart.tsx` to use new palette**

Replace hardcoded Chart.js colors with token-based colors. The component already uses CSS vars in some places; ensure all chart colors use the new semantic tokens.

- [ ] **Step 2: Verify `AppLayout.tsx` applies theme classes correctly**

Ensure `.app.dark-theme` and `.app` classes are applied at the root so all children inherit tokens.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatusChart.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(charts): update chart colors to new semantic palette"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run frontend build to catch TypeScript errors**

```bash
cd "/Users/matou/Kimi code - Workspace/QA-dashboard by kimi 2.0/frontend" && npm run build
```

Expected: Build completes with 0 errors.

- [ ] **Step 2: Run existing tests to ensure no regressions**

```bash
cd "/Users/matou/Kimi code - Workspace/QA-dashboard by kimi 2.0/frontend" && npm test -- --run
```

Expected: All tests pass (or only pre-existing failures).

- [ ] **Step 3: Run color utility tests**

```bash
cd "/Users/matou/Kimi code - Workspace/QA-dashboard by kimi 2.0/frontend" && npx vitest run src/lib/colors.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Visual smoke test checklist**

Manually verify in browser:

- [ ] Light mode page background is `#F6F8FA`
- [ ] Dark mode page background is `#0A0A0A`
- [ ] Cards have proper elevated surface color
- [ ] Pass Rate ≥ 95% shows green
- [ ] Pass Rate 85-94% shows yellow
- [ ] Pass Rate < 85% shows red
- [ ] Failure Rate ≤ 5% shows green
- [ ] Failure Rate 5-10% shows yellow
- [ ] Failure Rate > 10% shows red
- [ ] All dashboards display consistent colors
- [ ] Chart colors are visible in both modes

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(ui): complete color harmonization with github dark theme"
```

---

## Spec Coverage Check

| Spec Requirement                      | Task      |
| ------------------------------------- | --------- |
| New token palette (GitHub Dark)       | Task 1, 2 |
| Centralized threshold utility         | Task 3    |
| PreprodSection colors                 | Task 4    |
| ProductionSection colors              | Task 4    |
| MetricsCards colors                   | Task 4    |
| Dashboard5, TV, MultiProject, Compare | Task 5    |
| Chart colors                          | Task 6    |
| Verification                          | Task 7    |
