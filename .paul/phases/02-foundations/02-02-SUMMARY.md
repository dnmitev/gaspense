---
phase: 02-foundations
plan: 02
subsystem: testing
tags: [vitest, playwright, testing-library, ci, e2e, mobile-viewport]

# Dependency graph
requires:
  - phase: 02-01
    provides: The Next.js app this plan tests, and the CI workflow it extends
provides:
  - Vitest + React Testing Library unit/integration harness
  - Playwright e2e across desktop and mobile viewports, against the production build
  - "`start`, `test`, `test:e2e` scripts"
  - Unit + Playwright-install + e2e steps in CI
  - Corrected agent docs (no longer misstate which commands exist)
affects: [02-03, 02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added:
    [vitest, "@vitejs/plugin-react", jsdom, "@testing-library/react", "@testing-library/dom", "@testing-library/jest-dom", "@playwright/test"]
  patterns:
    - "Every test runner must be demonstrated failing before it is trusted"
    - "e2e serves the production build so the dev server's AGENTS.md rewrite never dirties the tree"
    - "Vitest and Playwright are scoped to disjoint directories so neither collects the other's specs"

key-files:
  created:
    [vitest.config.ts, playwright.config.ts, tests/unit/setup.ts, tests/unit/page.test.tsx, tests/e2e/home.spec.ts]
  modified: [package.json, .github/workflows/ci.yml, CLAUDE.md, AGENTS.md, .paul/PROJECT.md]

key-decisions:
  - "Vitest keeps globals: false for explicit typed imports, so Testing Library cleanup is wired manually"
  - "Playwright webServer runs `npm run build && npm start`, never `next dev`"
  - "Mobile viewport (Pixel 7) is a first-class Playwright project, not an afterthought"
  - "Accepted the e2e step rebuilding the app rather than restructuring 01-01's verified workflow"

patterns-established:
  - "PROJECT.md metrics are corrected as soon as they become true, not left until the phase transition"

# Metrics
duration: 14min
started: 2026-08-07T15:00:17Z
completed: 2026-08-07T15:14:28Z
description: "Vitest and Playwright wired up with both runners proven failable, full CI gate green, and the stale agent docs corrected"
type: Summary
about: "gaspense"
---

# Phase 2 Plan 02: Test Infrastructure Summary

**The project's "unit + integration + automation tests every phase" requirement is now enforceable rather than aspirational — and both runners were proven able to fail, not merely to pass.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~14 min |
| Started | 2026-08-07T15:00:17Z |
| Completed | 2026-08-07T15:14:28Z |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 5 |
| Files modified | 5 |
| Escalation statuses | DONE ×3 — no concerns, no blocks, no waivers |
| Checkpoints | None |
| CI | `success` — check, build, unit, playwright-install, e2e all green |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Vitest runs real tests and can actually fail | **Pass** | 2 tests pass; a broken assertion produced exit 1 naming the failure, then restored to exit 0. Script is `vitest run` (non-watching) so CI cannot hang |
| AC-2: Playwright runs a real e2e test against the built app | **Pass** | 4 tests (2 specs × desktop-chromium + mobile-chromium) pass in 7.3s; a wrong title expectation produced exit 1 with 2 failures, then restored |
| AC-3: Test suites leave the working tree clean | **Pass** | Proven from a genuinely clean tree: ran the full e2e suite, tree still clean, `AGENTS.md` unmodified |
| AC-4: CI runs the full gate and stays green | **Pass** | Run `31191174702` — every step `success`, including the explicit Chromium install |
| AC-5: The agent docs tell the truth | **Pass** | "Not available yet" gone from both files; Commands *and* CI sections byte-identical; `nextjs-agent-rules` markers intact (1 BEGIN, 1 END, block body absent from the diff) |

## Verification Results

- `npm test` → 2 passed, exit 0; deliberately broken → exit 1; restored → exit 0
- `npm run test:e2e` → 4 passed across both viewport projects, exit 0; wrong expectation → exit 1
- **All exit codes read directly, never through a pipe** — the trap that produced wrong conclusions in 01-01 and 02-01
- AC-3 measured properly: tree clean *before*, e2e run, tree clean *after*, `git diff --quiet AGENTS.md` passed
- Runner isolation confirmed: Vitest discovers only `tests/unit/page.test.tsx`; Playwright picked up only `tests/e2e` (its 4-test run proves discovery); 0 cross-contamination each way
- CI step list queried via API rather than inferred: `Run check gate`, `Build`, `Unit tests`, `Install Playwright browser`, `E2E tests` — all `success`
- `npm run check` green throughout; the pre-push hook gated both of this plan's pushes

## Accomplishments

- **Caught a cross-test DOM leak that would have caused order-dependent failures.** The first unit
  run failed with "Found multiple elements" — Testing Library's automatic cleanup does not register
  when Vitest runs `globals: false`. Diagnosed from the actual error rather than worked around, and
  fixed by wiring `cleanup()` explicitly. Left alone, this class of bug surfaces much later as
  tests that pass alone and fail together.
- **The production-build decision was validated in practice.** AC-3 confirmed that running e2e
  leaves the tree pristine. Had Playwright used `next dev`, every test invocation would have
  regenerated the `AGENTS.md` block and left uncommitted changes behind permanently.
- **Mobile is tested, not assumed.** The mobile-first convention now has a Playwright project
  enforcing it, so a desktop-only regression is catchable.
- **Two live inaccuracies eliminated.** The agent docs no longer tell readers that working commands
  are unavailable, and PROJECT.md's CI metric reflects reality.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `vitest.config.ts` | Created | jsdom env, `tests/unit/**` scope, `@/` alias mirroring tsconfig |
| `tests/unit/setup.ts` | Created | jest-dom matchers via the `/vitest` entry + manual Testing Library cleanup |
| `tests/unit/page.test.tsx` | Created | Renders the real `app/page.tsx`; smoke-tests React 19 + TS + jsdom + alias |
| `playwright.config.ts` | Created | `tests/e2e` scope, desktop + Pixel 7 projects, `webServer` on the production build, 180s timeout |
| `tests/e2e/home.spec.ts` | Created | Title and heading assertions against the served app |
| `package.json` | Modified | `start`, `test`, `test:e2e` scripts; test devDependencies |
| `.github/workflows/ci.yml` | Modified | Unit tests, Chromium install, and e2e steps after Build |
| `CLAUDE.md`, `AGENTS.md` | Modified | Corrected command tables and CI section; deleted the false "Not available yet" table |
| `.paul/PROJECT.md` | Modified | CI success metric: Partially achieved → **Achieved** |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep `globals: false`, wire cleanup manually | Explicit imports stay type-safe without global type declarations | `tests/unit/setup.ts` must keep its `afterEach(cleanup)`; removing it reintroduces DOM leaks |
| Playwright serves the production build | `next dev` regenerates `AGENTS.md`; verified `next build` does not | e2e never dirties the working tree |
| Mobile viewport as a separate Playwright project | Mobile-first is a stated project convention | Desktop-only regressions are catchable |
| Explicit Chromium install step in CI | Runners have no browsers preinstalled | Avoids the standard first-failure when adding Playwright to a pipeline |
| Accept the duplicated build in the e2e step | Fixing it means touching 01-01's verified triggers/permissions/concurrency | Logged as a concern; optimise only if runs become slow |
| Update PROJECT.md's metric now rather than at the transition | It became demonstrably true during this plan | Avoids four more plans of stale reporting |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | A real cross-test pollution bug, found and fixed |
| Scope adjustments carried from planning | 1 | `.env.example` had already been moved to 02-03 at plan time |
| Boundary conflicts | 0 | — |
| Deferred | 0 | — |

**Total impact:** No scope creep, no waivers needed. The plan was executable as written.

### Auto-fixed Issues

**1. [Correctness] Testing Library cleanup never registered, leaking DOM between tests**

- **Found during:** Task 1, first `npm test` run
- **Issue:** `getByText` failed with *"Found multiple elements"* — the second test matched a `<p>`
  rendered by the first. Root cause: `@testing-library/react`'s automatic cleanup hooks a global
  `afterEach`, which does not exist when Vitest runs with `globals: false` (chosen deliberately for
  explicit typed imports).
- **Fix:** Added `afterEach(cleanup)` to `tests/unit/setup.ts`, with a comment explaining why it
  cannot be removed. Chose this over enabling `globals: true`, to keep the explicit-import property.
- **Verification:** Both tests pass; a broken assertion still fails correctly.
- **Why it mattered:** this is a latent, order-dependent bug class. With only two tests it produced
  a clear error; with fifty it would have produced intermittent failures that are painful to trace.

### Notes on Plan Fidelity

Unlike the three preceding plans, **02-02's verify commands were all correct** — no stale git
baselines, no `sed` ranges that could never match. The instruction to read installed package
versions before writing config also proved necessary again: Vitest 4 and
`@testing-library/jest-dom` v7 required the `/vitest` entry point, confirmed by inspecting the
package's `exports` map rather than assuming.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| First unit run failed on a "multiple elements" error | Not a bad assertion — a genuine cleanup gap. See Auto-fixed above. |
| My runner-isolation check printed garbled counts | The shell arithmetic mixed multi-line `grep -c` output. Re-ran with clean per-runner queries; both cross-contamination counts confirmed 0. |
| `playwright test --list` output did not match my grep pattern | Non-issue — the actual 4-test run enumerated `tests/e2e/home.spec.ts` explicitly, which is stronger evidence of discovery than `--list` parsing. |

## Next Phase Readiness

**Ready:**
- A full CI gate (check → build → unit → e2e) that Phase 2's remaining plans inherit automatically
- Test harnesses in place *before* the first real logic arrives, so 02-03's Prisma models and
  02-04's auth scoping can be tested from their first commit
- **This matters most for 02-04:** per-user isolation is app-layer, not enforced by Postgres RLS.
  There is no database backstop, so every query path needs a test proving one user cannot read
  another's rows. The harness for that now exists.

**Concerns:**
- **CI runs the build twice** (Build step, then Playwright's `webServer`). Harmless now; revisit if
  runs get slow.
- **`tests/unit/setup.ts`'s `afterEach(cleanup)` is load-bearing.** It looks like boilerplate and
  will be tempting to delete.
- **The e2e suite asserts placeholder copy.** `tests/e2e/home.spec.ts` checks text that plans
  02-05/02-06 will replace when real UI lands; expect to update it then rather than being surprised
  by a failure.
- **No coverage thresholds**, deliberately — meaningless against a placeholder page. Worth adding
  once there is real logic.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 02-foundations, Plan: 02*
*Completed: 2026-08-07*
