---
name: ultrareview
description: Deep multi-agent code review that runs a fleet of specialist reviewer subagents in parallel to find bugs, security issues, and design flaws in a diff or set of files. Each finding is independently verified before being reported. Produces ULTRAREVIEW.md with file-cited findings prioritized by severity. Use when the user asks for /ultrareview, deep code review, pre-merge review, or bug-hunting on a branch/PR. Does not auto-invoke.
disable-model-invocation: true
---

# Ultrareview — Multi-Agent Deep Code Review

When invoked via `/ultrareview`, follow the protocol below. Everything from here through the `---` divider is the protocol the agent executes. The section after the divider is documentation for humans.

---

## Operating principles

Higher signal than a single-pass `/review`. Every reported finding must be independently reproduced or strongly justified with a concrete code path. No style nitpicks. No generic best-practice violations without grounding in this specific change. No sycophancy.

Cite `file:line` for every concrete finding. Vague claims don't count.

## Phase 1: Scope detection

1. Determine what to review:
   - If the user passed a PR number or branch name (e.g., `/ultrareview 123` or `/ultrareview feature/auth-refactor`), use `git diff` against the default branch (`main` or `master`).
   - If no argument, use `git diff origin/main..HEAD` (or `master`) including uncommitted changes.
   - If the user passed file paths (e.g., `/ultrareview src/auth.ts src/api.py`), review those files directly.
   - If the repo is too large to review the entire diff in one go (>50 files or >5k LOC changed), warn the user and suggest scoping to a module or opening a PR.

2. Capture the file list and line counts:
   ```bash
   git diff --name-only <base>..<head>
   git diff --shortstat <base>..<head>
   ```

3. Read the diff content for each changed file. If there are >20 files, prioritize by:
   - Files with the most line changes
   - Files in critical paths (auth, API endpoints, database models)
   - Files lacking test changes

4. Publish a plan with `TodoWrite` showing:
   - Scope (branch/PR/files)
   - Number of files and lines
   - The 5 reviewer agents that will run
   - Estimated runtime

## Phase 2: Launch reviewer fleet (parallel subagents)

Dispatch **5 subagents in parallel**. Each gets the full diff context but focuses on one dimension. They must return findings as a structured list with `file:line`, severity, and a one-sentence reproduction rationale.

### Agent 1: SecurityReviewer
Focus: trust boundaries, auth, injection, secrets, permissions.

Checklist:
- Missing input validation on API endpoints (tRPC, REST, GraphQL)
- SQL injection patterns (string-concat queries, raw SQL without params)
- Hardcoded secrets, tokens, or credentials in source
- JWT/cookie weaknesses (weak secrets, missing expiry, no CSRF)
- Path traversal, SSRF, open redirects
- Overly permissive CORS or auth bypass
- Unsafe deserialization or eval/exec
- Race conditions in auth flows (TOCTOU)

Return format for each finding:
```
- [CRITICAL|HIGH|MEDIUM] `path/file.ext:LINE` — <one-line description> — <how to reproduce/exploit>
```

### Agent 2: CorrectnessReviewer
Focus: logic bugs, edge cases, error handling, state management.

Checklist:
- Off-by-one errors, boundary conditions
- Null/undefined/None dereferences
- Incorrect async/await usage (missing awaits, sync in async)
- Race conditions, concurrent mutation of shared state
- Error swallowing (bare `except: pass`, `.catch(() => {})`)
- Wrong comparison operators (`==` vs `===`, `is` vs `==`)
- Incorrect loop termination
- State that doesn't reset between requests
- Assumptions about data shape that aren't validated

Return format same as above.

### Agent 3: ArchitectureReviewer
Focus: design quality, coupling, cohesion, abstraction debt.

Checklist:
- God files (>500 LOC) or god functions (>100 LOC)
- Circular dependencies (`import a from b; import b from a`)
- Violations of layering (DB queries in controllers, HTTP in services)
- Duplicated logic across 2+ locations where an abstraction should exist
- Leaky abstractions (callers know internal details)
- Feature envy (a function manipulates another module's data)
- Dead code (unused exports, unreachable branches)
- Public APIs without contracts (no types, no docs, unclear invariants)

Return format same as above.

### Agent 4: PerformanceReviewer
Focus: resource usage, latency, throughput, scalability.

Checklist:
- N+1 queries (loop over results → DB call per iteration)
- Blocking I/O in async paths
- Memory leaks (unclosed connections, event listeners, accumulators)
- Missing pagination on list endpoints
- Inefficient algorithms (quadratic where linear suffices)
- Missing caching on hot paths
- Large objects serialized unnecessarily
- Database transactions held longer than needed

Return format same as above.

### Agent 5: TestReviewer
Focus: test quality, coverage gaps, confidence in the change.

Checklist:
- Critical paths changed without corresponding test changes
- Tests that assert implementation rather than behavior
- Missing edge-case tests (empty input, max bounds, error paths)
- Flaky tests (timers, randomness, unordered collections)
- Mocking the unit under test (testing the mock)
- Assertions that can never fail
- Tests that don't verify the "arrange" succeeded
- Coverage gaps on error handling branches

Return format same as above.

## Phase 3: Synthesize and verify

1. Collect all findings from the 5 subagents.
2. **Deduplicate**: identical file:line findings from multiple agents count as one, with merged rationale.
3. **Verify** the top findings:
   - For each CRITICAL and HIGH finding, re-read the cited code to confirm the issue exists and the reproduction rationale is accurate.
   - If a finding cannot be reproduced, discard it with a note.
   - If a finding is real but the severity is off, adjust it.
4. **Reject** style-only findings unless they materially impact readability in a way that causes bugs (e.g., misleading variable names).

## Phase 4: Deliverable

Write `ULTRAREVIEW.md` in the repo root with this structure:

```markdown
# Ultrareview — <Scope>
Generated: <ISO date>
Scope: <branch/PR/files>
Files reviewed: <N>
Lines changed: <N>

## Executive summary
- <N> CRITICAL, <N> HIGH, <N> MEDIUM, <N> LOW findings
- <1–2 sentence assessment of change readiness>

## Findings

### CRITICAL
| ID | Dimension | File:Line | Description | Reproduction |
|----|-----------|-----------|-------------|--------------|
| U001 | Security | src/auth.ts:42 | ... | ... |

### HIGH
| ID | Dimension | File:Line | Description | Reproduction |
|----|-----------|-----------|-------------|--------------|
| U005 | Correctness | src/api.py:88 | ... | ... |

### MEDIUM
...

### LOW
...

## Top 5 — if you fix nothing else, fix these
1. **U001** — <description with concrete fix suggestion>
2. ...

## Quick wins
- [ ] U012: <low-effort medium+ severity fix>
- ...

## False positives rejected
- <finding that was considered but rejected, with reasoning>

## Open questions
- <something unclear that needs maintainer input>
```

Rules for the deliverable:
- Every CRITICAL and HIGH finding must have a concrete code snippet showing the problem.
- Every finding must have a suggested fix or mitigation, not just "fix this".
- If there are zero findings in a severity tier, write "None found" rather than omitting it.

## Large diffs: module scoping

If the diff exceeds 50 files or 5,000 changed lines:
1. Group files by top-level directory/module.
2. Ask the user which modules to focus on, or run ultrareview on the top 3 modules by line count.
3. Spawn one fleet per selected module, then merge findings.

---

# Project documentation

Everything below is for humans installing, using, or contributing to this skill.

## Installation

Project-only install:

```bash
mkdir -p .claude/skills/ultrareview && cp /path/to/SKILL.md .claude/skills/ultrareview/SKILL.md
```

Verify it loaded:
```bash
echo "/skills" | claude
```

## Usage

```
/ultrareview
/ultrareview 1234          # review PR #1234
/ultrareview feature/x     # review branch feature/x
/ultrareview src/auth.ts   # review specific file
```

## How it differs from /review

| | `/review` | `/ultrareview` |
|---|---|---|
| Execution | Single agent, local | Fleet of 5 agents, parallel |
| Depth | Surface scan | Deep analysis with verification |
| Duration | Seconds to 1 min | 2–5 minutes |
| Focus | Quick feedback while iterating | Pre-merge confidence |
| Output | Inline chat | `ULTRAREVIEW.md` report |
| Signal | Catches obvious bugs | Catches subtle bugs, race conditions, design flaws |

## Philosophy

The value of ultrareview comes from three design choices:

1. **Specialist agents, not generalists.** A single agent reviewing everything tends to average out — it finds a little of everything but misses deep issues. Splitting into 5 focused agents forces each one to go deep on its dimension.

2. **Independent verification.** Before a finding lands in the report, the synthesizer re-reads the code to confirm it. This filters out hallucinated bugs.

3. **File:line citations with reproduction rationale.** A finding without a reproduction path is noise. Every item in the report tells you *how* to trigger the bug, not just *where* it is.

## Tuning

**Adjusting thresholds:** If your codebase has a higher baseline (e.g., god files are normal at 800 LOC), edit the ArchitectureReviewer checklist in the protocol.

**Adding dimensions:** For domain-specific concerns (e.g., ML pipelines, mobile accessibility), add a 6th subagent by editing the protocol.

**CI integration:** The non-interactive equivalent is running this skill via the Agent tool in a CI pipeline, passing the PR number as context.

## Limitations

- This is a static analysis, not a runtime analysis. It won't catch Heisenbugs or environment-specific issues.
- It can't verify business-logic correctness without domain knowledge.
- For very large monorepos (>200k LOC), even module-scoped reviews can be shallow. Consider scoping to a single service.

## License

MIT. Fork it, ship it, improve it.
