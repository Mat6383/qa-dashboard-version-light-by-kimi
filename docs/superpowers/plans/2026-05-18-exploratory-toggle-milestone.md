# Exploratory Toggle by Milestone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggle switch next to "Latest only" in Dashboard4's preprod campaign grid that displays exploratory runs linked to selected preprod milestones, unpaginated.

**Architecture:** A new `showExploratoryByMilestone` state lives in `Dashboard4`. `displayedRuns` is computed by merging the normal run list with filtered exploratory runs (by milestone). `CampaignGrid` separates normal and exploratory runs for pagination so exploratories are always shown. Props are drilled through `PreprodSection`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, @tanstack/react-query

---

## File Map

| File                                                    | Action | Responsibility                                              |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `frontend/src/types/api.types.ts`                       | Modify | Add `milestone?: number` to `Run` interface                 |
| `frontend/src/components/Dashboard4.tsx`                | Modify | Add state, computed `displayedRuns`, forward props          |
| `frontend/src/components/PreprodSection.tsx`            | Modify | Accept and forward new props to `CampaignGrid`              |
| `frontend/src/components/preprod/CampaignGrid.tsx`      | Modify | Add toggle UI, split normal/exploratory runs for pagination |
| `frontend/src/components/Dashboard4.test.jsx`           | Modify | Add tests for computed runs with toggle ON/OFF              |
| `frontend/src/components/PreprodSection.test.tsx`       | Modify | Add test verifying props reach `CampaignGrid`               |
| `frontend/src/components/preprod/CampaignGrid.test.tsx` | Create | Test toggle presence, interaction, labels                   |

---

## Task 1: Update `Run` type with `milestone`

**Files:**

- Modify: `frontend/src/types/api.types.ts:90-106`

- [ ] **Step 1: Add `milestone?: number` to `Run`**

```ts
export interface Run {
  id: number | string;
  name: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  wip: number;
  untested: number;
  completionRate: number;
  passRate: number;
  isExploratory: boolean;
  isClosed: boolean;
  created_at: string;
  milestone?: number; // ← AJOUT
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: No new errors related to `Run`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/api.types.ts
git commit -m "types: add milestone field to Run interface"
```

---

## Task 2: Add state and computed runs in `Dashboard4`

**Files:**

- Modify: `frontend/src/components/Dashboard4.tsx:83,113-116,282-301`

- [ ] **Step 1: Add state after existing toggles (around line 83)**

```tsx
const [showExploratoryByMilestone, setShowExploratoryByMilestone] = React.useState(false);
```

- [ ] **Step 2: Replace `displayedRuns` useMemo (around lines 113-116)**

```tsx
const displayedRuns = useMemo(() => {
  let base = showLatestOnly && latestRun ? [latestRun] : sortedRuns;
  if (showExploratoryByMilestone && selectedPreprodMilestones.length > 0) {
    const exploratory = sortedRuns.filter(
      (r) =>
        r.isExploratory &&
        selectedPreprodMilestones.includes(r.milestone as number) &&
        !base.some((br) => br.id === r.id)
    );
    base = [...base, ...exploratory];
  }
  return base;
}, [showLatestOnly, latestRun, sortedRuns, showExploratoryByMilestone, selectedPreprodMilestones]);
```

- [ ] **Step 3: Forward new props to `PreprodSection` (around line 282-301)**

Add inside the `<PreprodSection ... />` call:

```tsx
showExploratoryByMilestone = { showExploratoryByMilestone };
setShowExploratoryByMilestone = { setShowExploratoryByMilestone };
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard4.tsx
git commit -m "feat(dashboard4): add exploratoryByMilestone state and computed runs"
```

---

## Task 3: Forward props through `PreprodSection`

**Files:**

- Modify: `frontend/src/components/PreprodSection.tsx:75-94,98-117,181-190`

- [ ] **Step 1: Add props to interface (after `setShowLatestOnly`)**

```ts
  showExploratoryByMilestone?: boolean;
  setShowExploratoryByMilestone?: (show: boolean) => void;
```

- [ ] **Step 2: Destructure new props in component signature**

Add after `setShowLatestOnly,` in the destructuring:

```tsx
  showExploratoryByMilestone = false,
  setShowExploratoryByMilestone,
```

- [ ] **Step 3: Forward to `CampaignGrid`**

Add inside `<CampaignGrid ... />`:

```tsx
showExploratoryByMilestone = { showExploratoryByMilestone };
setShowExploratoryByMilestone = { setShowExploratoryByMilestone };
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PreprodSection.tsx
git commit -m "feat(preprod-section): forward exploratoryByMilestone props to CampaignGrid"
```

---

## Task 4: Add toggle and adaptive pagination in `CampaignGrid`

**Files:**

- Modify: `frontend/src/components/preprod/CampaignGrid.tsx:6-15,22-26,36-66,71-102`

- [ ] **Step 1: Extend props interface**

```ts
interface CampaignGridProps {
  sortedRuns: Run[];
  originalRunsCount?: number;
  showAllRuns: boolean;
  setShowAllRuns: (show: boolean) => void;
  showLatestOnly?: boolean;
  setShowLatestOnly?: (show: boolean) => void;
  showExploratoryByMilestone?: boolean;
  setShowExploratoryByMilestone?: (show: boolean) => void;
  useBusiness: boolean;
  isDark: boolean;
}
```

- [ ] **Step 2: Destructure new props**

Add in the function parameters:

```tsx
  showExploratoryByMilestone = false,
  setShowExploratoryByMilestone,
```

- [ ] **Step 3: Replace pagination logic (inside component body)**

Replace the existing `displayCount`/`visibleRuns` block with:

```tsx
const normalRuns = showExploratoryByMilestone ? sortedRuns.filter((r) => !r.isExploratory) : sortedRuns;
const exploratoryRuns = showExploratoryByMilestone ? sortedRuns.filter((r) => r.isExploratory) : [];

const displayCount = showAllRuns ? normalRuns.length : normalRuns.length <= 12 ? 12 : 8;
const visibleNormal = normalRuns.slice(0, displayCount);
const visibleRuns = [...visibleNormal, ...exploratoryRuns];
const totalCount = originalRunsCount ?? sortedRuns.length;
const hasMore = normalRuns.length > displayCount && !showAllRuns;
```

- [ ] **Step 4: Add new toggle in the controls row (between existing toggles)**

Insert before the existing `<Toggle label={useBusiness ? 'Tout afficher' : 'Show All'} ... />`:

```tsx
{
  setShowExploratoryByMilestone && (
    <Toggle
      label={useBusiness ? 'Exploratoires' : 'Exploratory'}
      checked={showExploratoryByMilestone}
      onChange={() => setShowExploratoryByMilestone(!showExploratoryByMilestone)}
    />
  );
}
```

- [ ] **Step 5: Run existing tests**

Run: `cd frontend && npm test -- src/components/preprod/CampaignGrid.test.tsx --run 2>/dev/null || echo "No existing tests yet"`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/preprod/CampaignGrid.tsx
git commit -m "feat(campaign-grid): add exploratory toggle and adaptive pagination"
```

---

## Task 5: Write `CampaignGrid.test.tsx`

**Files:**

- Create: `frontend/src/components/preprod/CampaignGrid.test.tsx`

- [ ] **Step 1: Create test file**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CampaignGrid from './CampaignGrid';

const baseProps = {
  sortedRuns: [],
  showAllRuns: false,
  setShowAllRuns: vi.fn(),
  showLatestOnly: false,
  setShowLatestOnly: vi.fn(),
  useBusiness: true,
  isDark: false,
};

describe('CampaignGrid', () => {
  it('renders exploratory toggle when setter is provided', () => {
    render(<CampaignGrid {...baseProps} showExploratoryByMilestone={false} setShowExploratoryByMilestone={vi.fn()} />);
    expect(screen.getByText('Exploratoires')).toBeInTheDocument();
  });

  it('does not render exploratory toggle when setter is absent', () => {
    render(<CampaignGrid {...baseProps} />);
    expect(screen.queryByText('Exploratoires')).not.toBeInTheDocument();
  });

  it('calls setShowExploratoryByMilestone on toggle click', () => {
    const setter = vi.fn();
    render(<CampaignGrid {...baseProps} showExploratoryByMilestone={false} setShowExploratoryByMilestone={setter} />);
    fireEvent.click(screen.getByText('Exploratoires'));
    expect(setter).toHaveBeenCalledWith(true);
  });

  it('shows English label when useBusiness is false', () => {
    render(
      <CampaignGrid
        {...baseProps}
        useBusiness={false}
        showExploratoryByMilestone={false}
        setShowExploratoryByMilestone={vi.fn()}
      />
    );
    expect(screen.getByText('Exploratory')).toBeInTheDocument();
  });

  it('always shows exploratory runs when toggle is ON regardless of normal limit', () => {
    const normalRuns = Array.from({ length: 15 }, (_, i) => ({
      id: `run-${i}`,
      name: `Run ${i}`,
      total: 10,
      completed: 5,
      passed: 5,
      failed: 0,
      blocked: 0,
      skipped: 0,
      wip: 0,
      untested: 0,
      completionRate: 50,
      passRate: 100,
      isExploratory: false,
      isClosed: false,
      created_at: '2026-05-18T10:00:00Z',
    }));
    const exploratoryRuns = [
      {
        id: 'exp-1',
        name: 'Session 1',
        total: 5,
        completed: 3,
        passed: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        wip: 0,
        untested: 2,
        completionRate: 60,
        passRate: 100,
        isExploratory: true,
        isClosed: false,
        created_at: '2026-05-18T10:00:00Z',
      },
    ];
    render(
      <CampaignGrid
        {...baseProps}
        sortedRuns={[...normalRuns, ...exploratoryRuns]}
        showExploratoryByMilestone={true}
        setShowExploratoryByMilestone={vi.fn()}
      />
    );
    // 8 normal runs + 1 exploratory should be visible
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('+ 7 autres campagnes...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npm test -- src/components/preprod/CampaignGrid.test.tsx --run`
Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/preprod/CampaignGrid.test.tsx
git commit -m "test(campaign-grid): add tests for exploratory toggle"
```

---

## Task 6: Add tests to `PreprodSection.test.tsx`

**Files:**

- Modify: `frontend/src/components/PreprodSection.test.tsx`

- [ ] **Step 1: Add test verifying props reach CampaignGrid**

Append inside the `describe('PreprodSection', ...)` block:

```tsx
it('forwards showExploratoryByMilestone to CampaignGrid', () => {
  const setter = vi.fn();
  render(<PreprodSection {...defaultProps} showExploratoryByMilestone={true} setShowExploratoryByMilestone={setter} />);
  // CampaignGrid shows the toggle when setter is provided
  expect(screen.getByText('Exploratoires')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npm test -- src/components/PreprodSection.test.tsx --run`
Expected: All tests PASS (5 total).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PreprodSection.test.tsx
git commit -m "test(preprod-section): verify exploratoryByMilestone props forwarded"
```

---

## Task 7: Add tests to `Dashboard4.test.jsx`

**Files:**

- Modify: `frontend/src/components/Dashboard4.test.jsx`

- [ ] **Step 1: Add tests at end of describe block**

```jsx
it('affiche les runs exploratoires liés à la milestone quand le toggle est ON', () => {
  const metricsWithManyRuns = {
    ...mockMetrics,
    runs: [
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `run-${i}`,
        name: `Run ${i}`,
        total: 10,
        completed: 5,
        passed: 5,
        failed: 0,
        blocked: 0,
        skipped: 0,
        wip: 0,
        untested: 0,
        completionRate: 50,
        passRate: 100,
        isExploratory: false,
        isClosed: false,
        created_at: '2026-05-18T10:00:00Z',
        milestone: 1,
      })),
      {
        id: 'exp-1',
        name: 'Session exploratoire M1',
        total: 5,
        completed: 3,
        passed: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        wip: 0,
        untested: 2,
        completionRate: 60,
        passRate: 100,
        isExploratory: true,
        isClosed: false,
        created_at: '2026-05-18T10:00:00Z',
        milestone: 1,
      },
      {
        id: 'exp-2',
        name: 'Session exploratoire M2',
        total: 5,
        completed: 3,
        passed: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        wip: 0,
        untested: 2,
        completionRate: 60,
        passRate: 100,
        isExploratory: true,
        isClosed: false,
        created_at: '2026-05-18T10:00:00Z',
        milestone: 99,
      },
    ],
  };
  renderDashboard({
    metrics: metricsWithManyRuns,
    selectedPreprodMilestones: [1],
  });
  fireEvent.click(screen.getByText('Exploratoires'));
  expect(screen.getByText('Session exploratoire M1')).toBeInTheDocument();
  expect(screen.queryByText('Session exploratoire M2')).not.toBeInTheDocument();
});

it('ne duplique pas un run exploratoire déjà dans la liste de base', () => {
  const metricsWithDuplicate = {
    ...mockMetrics,
    runs: [
      {
        id: 'run-1',
        name: 'R10 - run 1',
        isExploratory: false,
        milestone: 1,
      },
      {
        id: 'exp-1',
        name: 'Session exploratoire',
        total: 5,
        completed: 3,
        passed: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        wip: 0,
        untested: 2,
        completionRate: 60,
        passRate: 100,
        isExploratory: true,
        isClosed: false,
        created_at: '2026-05-18T10:00:00Z',
        milestone: 1,
      },
    ],
  };
  renderDashboard({
    metrics: metricsWithDuplicate,
    selectedPreprodMilestones: [1],
  });
  fireEvent.click(screen.getByText('Exploratoires'));
  const cards = screen.getAllByText('Session exploratoire');
  expect(cards.length).toBe(1);
});
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npm test -- src/components/Dashboard4.test.jsx --run`
Expected: All tests PASS (8 total).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard4.test.jsx
git commit -m "test(dashboard4): add exploratoryByMilestone toggle tests"
```

---

## Task 8: Full test suite validation

- [ ] **Step 1: Run all frontend tests**

Run: `cd frontend && npm test -- --run`
Expected: All tests PASS. No regressions.

- [ ] **Step 2: Run linter**

Run: `cd frontend && npx eslint src/components/Dashboard4.tsx src/components/PreprodSection.tsx src/components/preprod/CampaignGrid.tsx src/types/api.types.ts`
Expected: No errors.

- [ ] **Step 3: Final commit (if any fixes needed)**

If no fixes are needed, this task is verification only.

---

## Self-Review Checklist

1. **Spec coverage:**
   - `milestone?: number` on `Run` → Task 1 ✅
   - `showExploratoryByMilestone` state in Dashboard4 → Task 2 ✅
   - `displayedRuns` computed with merge + dedup → Task 2 ✅
   - Props forwarded through PreprodSection → Task 3 ✅
   - Toggle UI in CampaignGrid → Task 4 ✅
   - Pagination: normal runs limited, exploratories always shown → Task 4 ✅
   - Tests for Dashboard4, CampaignGrid, PreprodSection → Tasks 5-7 ✅

2. **Placeholder scan:** No TBD/TODO/fill-in-details found.

3. **Type consistency:**
   - `showExploratoryByMilestone?: boolean` used consistently across Dashboard4, PreprodSection, CampaignGrid ✅
   - `setShowExploratoryByMilestone?: (show: boolean) => void` signature matches everywhere ✅
   - `milestone?: number` added once in types and cast with `as number` in filter ✅
