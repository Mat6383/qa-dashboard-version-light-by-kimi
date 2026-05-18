# Ultrareview — Option C Pro Suite + Bug Fixes

Generated: 2026-05-18T16:25:00+02:00
Scope: commit 056d667..c8d3fe9 (main)
Files reviewed: 32
Lines changed: +2546 / -411

## Executive summary

- **0 CRITICAL, 10 HIGH, 25 MEDIUM, 1 LOW** findings
- **4 CRITICAL** test coverage gaps (no tests for 4 new critical hooks/components)
- The feature set is functionally solid but has **security hardening gaps** on backend endpoints (DoS amplification, unbounded queries), **logic bugs** in temporal comparison (Failure Rate deltas always null), **race conditions** in async effects, and **significant missing test coverage** on all new Option C code.

## Findings

### CRITICAL

None found in runtime code. **4 CRITICAL coverage gaps** identified by TestReviewer:

| ID   | Dimension | File:Line                                        | Description                                 | Reproduction                                                                                                                          |
| ---- | --------- | ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| U001 | Test      | `frontend/src/hooks/useTemporalComparison.ts:1`  | Zero tests for new temporal comparison hook | No test file exists; hook computes J-7/J-14/J-30 deltas with edge cases (previous=0, null snapshots, API errors) completely uncovered |
| U002 | Test      | `frontend/src/hooks/useDashboardLayout.ts:1`     | Zero tests for new layout persistence hook  | No test file exists; localStorage read/write, cross-tab sync via `storage` event, and `moveWidget` logic untested                     |
| U003 | Test      | `frontend/src/components/PreprodSection.tsx:1`   | Zero tests for new PreprodSection component | No test file exists; drag-and-drop integration, temporal delta pills, campaign toggles, and run rendering untested                    |
| U004 | Test      | `frontend/src/components/CompareDashboard.tsx:1` | Zero tests for CompareDashboard component   | No test file exists; project selection limit (max 4), API error handling, and AbortController cleanup untested                        |

### HIGH

| ID   | Dimension    | File:Line                                           | Description                                                                                                                               | Reproduction                                                                                                                                            |
| ---- | ------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U005 | Security     | `backend_py/app/routers/dashboard.py:153`           | SSE `/dashboard/{project_id}/stream` has no auth dependency, no max-duration, and no rate limiting; each connection polls Testmo every 5s | Open hundreds of `EventSource` connections to `/dashboard/1/stream` → DoS against backend and Testmo                                                    |
| U006 | Security     | `backend_py/app/routers/dashboard.py:47`            | `/dashboard/multi` with no `project_ids` fetches ALL projects and fans out unbounded concurrent `get_project_metrics` calls               | `GET /dashboard/multi` with no params when Testmo has N projects → N concurrent API calls with no semaphore                                             |
| U007 | Performance  | `backend_py/app/services/testmo_metrics.py:235-268` | `_count_prod_bugs` falls back to one external API call per run in `fallback_runs` (N+1 HTTP)                                              | Call `get_escape_and_detection_rates` for a project with many runs → O(n) sequential HTTP calls to Testmo                                               |
| U008 | Performance  | `backend_py/app/services/testmo_metrics.py:463-473` | `compare_projects` launches unbounded concurrent calls via `asyncio.gather(*tasks)` with no batch size limit                              | `GET /dashboard/compare?project_ids=1&project_ids=2&...&project_ids=50` → 50 concurrent requests to Testmo                                              |
| U009 | Performance  | `backend_py/app/routers/dashboard.py:118-150`       | `get_trends` queries ALL `MetricSnapshot` rows for a project with no `LIMIT` or pagination                                                | Project with 2+ years of daily snapshots → unbounded memory usage and response size                                                                     |
| U010 | Performance  | `backend_py/app/routers/dashboard.py:153-171`       | SSE `stream_dashboard` has no timeout on `testmo_service.get_project_metrics`; `is_disconnected()` only checked at loop start             | Client disconnects after first iteration → backend continues calling Testmo until the 5s sleep ends                                                     |
| U011 | Performance  | `frontend/src/hooks/useTemporalComparison.ts:145`   | `getTemporalForMetric` is not wrapped in `useCallback`; returns a new function reference on every render                                  | Dashboard4 re-renders → PreprodSection and ProductionSection re-render unnecessarily, breaking downstream memoization                                   |
| U012 | Architecture | `frontend/src/components/PreprodSection.tsx:1`      | 507-LOC god component mixing drag-and-drop orchestration, inline data transforms, campaign grid rendering, and per-widget JSX mapping     | File exceeds 500 LOC; separation of concerns violated                                                                                                   |
| U013 | Architecture | `frontend/src/components/PreprodSection.tsx:207`    | `renderWidget` switch duplicates ~80 lines of near-identical `KPICard` prop patterns across 4 widgets                                     | Adding a 5th widget requires copying another block of 20 lines instead of adding a config entry                                                         |
| U014 | Test         | `frontend/src/lib/charts.test.ts:28`                | Only Pass Rate dataset is asserted; missing test for complete dataset list                                                                | `buildHistoricalChartData` omits `blocked_rate` dataset from output but this is untested; regression possible if another metric is accidentally dropped |
| U015 | Test         | `frontend/src/hooks/useExportPDF.test.js:107`       | `exportElement` convenience wrapper is completely untested                                                                                | Public API added in Option C (`exportElement(element, filename)`) has zero coverage                                                                     |
| U016 | Test         | `frontend/src/hooks/useExportPDF.test.js:45`        | `multiPage` option and `format: 'png'` branches are untested                                                                              | Significant pagination and PNG download logic uncovered                                                                                                 |
| U017 | Test         | `frontend/src/components/Dashboard4.test.jsx:120`   | No tests for TV mode, modal triggers, per-card export, or `setExportHandler` registration                                                 | Major new Pro Suite interaction paths completely untested                                                                                               |

### MEDIUM

| ID   | Dimension    | File:Line                                                                     | Description                                                                                                                          | Reproduction                                                                                  |
| ---- | ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| U018 | Security     | `backend_py/app/routers/dashboard.py:36`                                      | `_parse_csv_ints` lacks input-length limits; multi-megabyte query strings cause memory exhaustion / CPU DoS                          | `GET /dashboard/1?preprodMilestones=1,1,1,…` (1 MB of repeats) → server parses entire payload |
| U019 | Security     | `backend_py/app/services/testmo_metrics.py:256`                               | `run_id` from Testmo JSON is interpolated directly into URL path without type validation or path sanitization                        | If Testmo returns `"id": "1/../../admin"`, backend requests `…/runs/1/../../admin/results`    |
| U020 | Architecture | `backend_py/app/routers/dashboard.py:126`                                     | `get_trends` imports SQLAlchemy and `MetricSnapshot` directly inside route handler, bypassing service layer                          | DB query logic lives in controller instead of a service/repository                            |
| U021 | Architecture | `frontend/src/hooks/useTemporalComparison.ts:145`                             | `getTemporalForMetric` patches `current: 0` placeholders because hook builds incomplete `MetricTemporal` objects                     | Consumers reading `comparison` directly get fake `current: 0` data instead of real values     |
| U022 | Architecture | `frontend/src/components/CompareDashboard.tsx:18` & `HistoricalTrends.tsx:27` | Both embed identical `apiClient` + `AbortController` + loading/error state boilerplate inline                                        | Duplicated async logic across 2+ locations; should be a `useFetch` hook                       |
| U023 | Architecture | `frontend/src/lib/charts.ts:90`                                               | `buildCompareRequestConfig` returns axios `paramsSerializer` config in a file claiming "Pure helpers for Chart.js data construction" | HTTP transport details leaked into chart helper module                                        |
| U024 | Architecture | `backend_py/app/services/testmo_metrics.py:66`                                | Magic status ID mapping (`status1_count` = Passed, etc.) duplicated in 3 methods with no shared constants                            | Changing a status ID requires editing 3 separate locations                                    |
| U025 | Architecture | `backend_py/app/services/testmo_metrics.py:256`                               | `TestmoMetrics` accesses `self._client._get()` (private method) to fetch run results                                                 | Breaks client encapsulation; metrics service coupled to internal client implementation        |
| U026 | Architecture | `frontend/src/components/Dashboard4.tsx:44`                                   | Component props are untyped (implicit `any`)                                                                                         | No compile-time contract or documented invariants for the main dashboard component            |
| U027 | Architecture | `frontend/src/components/CompareDashboard.tsx:44`                             | Inline snake_case-to-camelCase field mapping inside a presentational component                                                       | Data-mapping logic belongs in an API service/mapper layer                                     |
| U028 | Architecture | `backend_py/app/routers/dashboard.py:153`                                     | `stream_dashboard` reimplements its own try/except/error-logging instead of reusing `_safe_testmo_call`                              | Duplicated error-handling pattern; drift risk if `_safe_testmo_call` is updated               |
| U029 | Architecture | `frontend/src/hooks/useTemporalComparison.ts:47`                              | Undocumented heuristic mapping (`testEfficiency` → `pass_rate`, `failureRate` → `blocked_rate`)                                      | No explanation of why these equivalences hold; maintainers will be confused                   |
| U030 | Performance  | `backend_py/app/routers/dashboard.py:44-61`                                   | `multi_project_dashboard` with empty `project_ids` fetches ALL projects then compares ALL with no upper limit                        | Amplifies thundering-herd risk from U008 when Testmo has many projects                        |
| U031 | Performance  | `backend_py/app/services/testmo_metrics.py:94`                                | `datetime.now(timezone.utc).timestamp()` evaluated inside a generator expression, recomputed for every run                           | Inefficient; should be computed once before the loop                                          |
| U032 | Performance  | `frontend/src/components/PreprodSection.tsx:187-284`                          | `renderWidget` defined inside component body creates fresh inline arrow functions for every widget on every render                   | Each case creates `onExport={(el) => onExportCard(...)}`, invalidating `KPICard` memoization  |
| U033 | Performance  | `frontend/src/components/PreprodSection.tsx:425-426`                          | `onMouseEnter` and `onMouseLeave` are inline arrow functions assigned to every campaign card                                         | New functions created for every card on every render                                          |
| U034 | Performance  | `frontend/src/hooks/useExportPDF.ts:45`                                       | `html2canvas` uses `scale: 2` with no maximum element size guard                                                                     | Large dashboards generate 4× pixel-density canvases that stay in memory until PDF is saved    |
| U035 | Test         | `frontend/src/hooks/useExportPDF.test.js:118`                                 | `preCapture` test only asserts display restored to `'none'`, never verifies it was temporarily `'block'`                             | Test passes even if implementation does nothing                                               |
| U036 | Test         | `frontend/src/hooks/useExportPDF.test.js:130`                                 | `mockRejectedValueOnce` persists across tests because `clearAllMocks` doesn't reset implementations                                  | Flaky if a test fails before consuming the mock rejection                                     |
| U037 | Test         | `frontend/src/hooks/useExportPDF.test.js:143`                                 | Null-element test asserts `html2canvas` not called but never checks `isExporting` remains false                                      | Misses state bug if early return moves after `setIsExporting(true)`                           |
| U038 | Test         | `frontend/src/components/Dashboard4.test.jsx:141`                             | GitLab sync tab uses synchronous `getByText` instead of `findByText`                                                                 | Potentially flaky if unmocked child component renders asynchronously                          |
| U039 | Test         | `frontend/src/components/AppLayout.test.tsx:55`                               | No test for `circuitBreakers` OPEN degraded-mode banner                                                                              | Untested error-state UI branch                                                                |
| U040 | Test         | `frontend/src/lib/charts.test.ts:10`                                          | No empty-array test for `buildHistoricalChartData` or `buildCompareChartData`                                                        | Missing edge case for empty input → potential runtime errors on empty data                    |

### LOW

| ID   | Dimension   | File:Line                                          | Description                                                                                                                                    | Reproduction                                                                                                            |
| ---- | ----------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| U041 | Security    | `frontend/src/components/Dashboard4.tsx:114`       | `project.name` from API interpolated directly into PDF export filename without sanitization                                                    | If API returns `../../../etc/passwd`, `pdf.save()` may attempt to write outside downloads folder on non-browser clients |
| U042 | Correctness | `frontend/src/hooks/useTemporalComparison.ts:56`   | `getMetricKeyFromName` maps `'failureRate'` → `'failure_rate'`, but `comparison` map key is `'failureRate'` (built from `'blocked_rate'` data) | Failure Rate KPI card never displays J-7/J-14/J-30 deltas even when historical data exists                              |
| U043 | Correctness | `frontend/src/components/CompareDashboard.tsx:58`  | Race condition: `finally` unconditionally calls `setLoading(false)` without checking `controller.signal.aborted`                               | Rapidly toggle project selections → spinner disappears while newer request is still running                             |
| U044 | Correctness | `frontend/src/components/HistoricalTrends.tsx:46`  | Same race condition as U043: aborted request incorrectly clears loading state                                                                  | Rapidly switch date range/granularity → spinner disappears prematurely                                                  |
| U045 | Correctness | `frontend/src/hooks/useTemporalComparison.ts:80`   | `computeDelta` returns `null` when `previous === 0`, suppressing legitimate deltas                                                             | Escape rate moving from 0% to 5% shows no delta pill                                                                    |
| U046 | Correctness | `frontend/src/components/CompareDashboard.tsx:25`  | Bare `.catch(() => {})` swallows `/projects` fetch error                                                                                       | API failure silently renders "Aucun projet disponible" with no error state                                              |
| U047 | Correctness | `backend_py/app/routers/dashboard.py:122-150`      | `/trends` accepts `granularity` parameter but ignores it completely                                                                            | Select "Semaine" or "Mois" in Historical Trends but still see unaggregated daily rows                                   |
| U048 | Correctness | `backend_py/app/services/testmo_metrics.py:96-105` | `lead_time` divides by `len(runs)` (all runs) but numerator filters with `if r.get("created_at")`                                              | Runs missing `created_at` artificially deflate average lead time                                                        |
| U049 | Correctness | `backend_py/app/services/testmo_metrics.py:328`    | `active_milestones.sort(key=lambda m: m.get("id", 0))` raises `TypeError` if `id` is `null`                                                    | Quality-rates for project with null milestone id → HTTP 500                                                             |
| U050 | Correctness | `backend_py/app/routers/dashboard.py:36-38`        | `_parse_csv_ints` raises unhandled `ValueError` on non-numeric input                                                                           | `?preprodMilestones=abc` → HTTP 500 instead of 422                                                                      |
| U051 | Correctness | `frontend/src/hooks/useDashboardLayout.ts:42-48`   | Layout validation does not verify uniqueness of widget IDs                                                                                     | Corrupted localStorage with duplicate IDs passes validation, causing missing widgets and React key warnings             |
| U052 | Correctness | `backend_py/app/services/testmo_metrics.py:430`    | `year = str(started)[:4] if isinstance(started, str) else started.year` assumes string or datetime                                             | Integer timestamp in `started_at` → `AttributeError`                                                                    |

## Top 5 — if you fix nothing else, fix these

1. **U042** — Fix the `failureRate` → `failure_rate` key mismatch in `useTemporalComparison.ts`. This is a live bug: the Failure Rate widget never shows temporal deltas.
2. **U005 + U006** — Add rate limiting, auth, and max-duration to SSE `/dashboard/{project_id}/stream`, and cap `/dashboard/multi` concurrent calls with a semaphore + project limit. These are trivial DoS vectors.
3. **U001–U004** — Write tests for `useTemporalComparison`, `useDashboardLayout`, `PreprodSection`, and `CompareDashboard`. Zero tests on new critical code is a regression time-bomb.
4. **U043 + U044** — Guard `setLoading(false)` in `finally` blocks with `if (!controller.signal.aborted)` to prevent race conditions in CompareDashboard and HistoricalTrends.
5. **U008** — Add `Semaphore(5)` or batching to `compare_projects` in `testmo_metrics.py`. Unbounded concurrency will eventually get you rate-limited or banned by Testmo.

## Quick wins

- [ ] U042: Fix `failureRate` key mapping in `useTemporalComparison.ts`
- [ ] U043 + U044: Guard `setLoading(false)` with `!controller.signal.aborted`
- [ ] U018: Add `maxsplit=100` and length check to `_parse_csv_ints`
- [ ] U019: Validate `run_id` is `int` before URL interpolation
- [ ] U028: Replace inline try/except in `stream_dashboard` with `_safe_testmo_call`
- [ ] U024: Extract magic status IDs into module-level constants
- [ ] U031: Move `datetime.now(...).timestamp()` outside the generator expression
- [ ] U032: Memoize `renderWidget` cases or extract to config-driven renderer
- [ ] U040: Add empty-array tests to `charts.test.ts`
- [ ] U045: Allow delta computation when `previous === 0` in `computeDelta`
- [ ] U046: Surface `/projects` fetch error in CompareDashboard instead of swallowing
- [ ] U047: Implement granularity aggregation in `/trends` backend endpoint
- [ ] U050: Catch `ValueError` in `_parse_csv_ints` and return HTTP 422

## False positives rejected

- **"CSS variables in Chart.js are a security risk"** — Rejected. These were already fixed in this commit; `charts.ts` now uses static hex colors.
- **"localStorage in `useDashboardLayout` is a XSS vector"** — Rejected. The hook only stores widget order strings; no user input is serialized.

## Open questions

- What is the intended upper bound for concurrent Testmo API calls? (needed to size semaphores for U008)
- Should `getTemporalForMetric` be removed and `comparison` recomputed with actual current values instead of patching at call time? (U021)
- Is the SSE stream endpoint (`/dashboard/{project_id}/stream`) actually used by the frontend? If not, consider removing it to eliminate U005 and U010.
