---
phase: 03-reporting
plan: 03
subsystem: reporting
tags: [dashboard, svg, charts, server-components, accessibility, fleet, mutation-testing]

requires:
  - phase: 03-reporting
    provides: byMonth aggregation (03-01), buildConsumption and formatEurPerKm (03-02)
  - phase: 09-demo-data-seed
    provides: the populated account the dashboard was verified against
provides:
  - lib/chart.ts — bar scaling, pure and import-free
  - lib/fleet.ts — the all-cars roll-up with measured scoping
  - app/monthly-chart.tsx — server-rendered inline SVG, no client JavaScript
  - "/ as the dashboard, replacing the Phase 2 placeholder"
affects: [04-pwa-mobile-ux, 07-maintenance-reminders]

tech-stack:
  added: []
  patterns:
    - "Charts as hand-rolled server-rendered SVG, no charting library, no client boundary"
    - "Degenerate-case arithmetic extracted to a pure module so NaN cannot reach an attribute"
    - "Measure which filter is load-bearing per query shape; do not carry the answer across"

key-files:
  created:
    - lib/chart.ts
    - lib/fleet.ts
    - app/monthly-chart.tsx
    - tests/unit/chart.test.ts
    - tests/unit/monthly-chart.test.tsx
    - tests/integration/fleet.test.ts
  modified:
    - app/page.tsx
    - tests/e2e/home.spec.ts
  deleted:
    - tests/unit/page.test.tsx

key-decisions:
  - "Hand-rolled inline SVG rather than a charting library — no dependency, no client component"
  - "/ requires a session and redirects to /signin; no public landing page"
  - "The fleet query's two scope filters are redundant with each other — measured, not assumed"
  - "scaleBars is a module because the all-zero case renders height=NaN and fails silently"
  - "A car with unmeasurable consumption shows nothing, never 0.0 L/100km"

patterns-established:
  - "Page-level coverage moves to e2e once a page reads the session; jsdom renders only auth-free components"
  - "Assert charts against the served HTML, so a client-only chart cannot pass"

duration: 45min
started: 2026-08-10T06:59:59Z
completed: 2026-08-10T07:44:40Z
description: "The home page becomes the dashboard — fleet total, a twelve-month spend chart in server-rendered SVG, and a card per car — closing Phase 3"
type: Summary
about: "gaspense"
---

# Phase 3 Plan 03: Dashboard Summary

**`/` stopped being a placeholder and became the dashboard: €4,552.70 across one car, a
thirteen-bar monthly spend chart rendered as inline SVG with no JavaScript at all, and a card per
car showing its total and consumption — closing Phase 3.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~45 min |
| Started | 2026-08-10T06:59:59Z |
| Completed | 2026-08-10T07:44:40Z |
| Tasks | 4 of 4 (3 auto + 1 checkpoint) |
| Files created | 6 |
| Files modified | 2 |
| Files deleted | 1 |
| Tests added | +39 net (16 unit, 9 integration, 14 e2e) |

**Longer than its siblings' 21 and 17 minutes**, and worth being honest about why rather than
averaging it away: a test outside the plan's declared scope broke and needed replacing rather than
deleting, a mutation comment had to be corrected after measurement contradicted nothing but
sharpened it, and the dev server blocked the e2e run for a third time. None of those were
implementation difficulty. The three tasks themselves went in cleanly.

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: Fleet total and per-car totals | **Pass** | Two cars summing to 19,500 with 12,500 / 7,000 split; e2e asserts "Total across 1 car" against the seeded account |
| AC-2: Chart renders without JavaScript | **Pass** | e2e asserts against the **served HTML**, not the rendered DOM — `<svg` present, `<rect height="…">` present, no `height="NaN"`. A client-only chart would fail this |
| AC-3: Proportional bars, no divide-by-zero | **Pass** | 13 unit tests; mutation: removing the zero-guard fails 1, clamping after the max fails 3 |
| AC-4: Per-car consumption, or nothing | **Pass** | One car at 5.0 L/100km, one at `null`; e2e asserts `0.0 L/100km` has count 0 |
| AC-5: Only the caller's cars | **Pass** | Alice's total is €10 while Bob's €999 sits in the same table; Bob's rows re-read intact afterwards |
| AC-6: Soft-deleted car leaves, rows stay | **Pass** | Car drops off, total falls to 1,000, `expense.count` for the deleted car still 1 |
| AC-7: Signed-out redirects | **Pass** | e2e with no cookie: URL matches `/signin`, and no car or total text present |
| AC-8: Empty account is invited, not zeroed | **Pass** | "Get started" region shown; `Total spent` and `Monthly spend` regions have count 0, `€0.00` count 0 |
| AC-9: Cards link to the report | **Pass** | Click-through lands on `/cars/{id}/report` with the right car's heading |

## Verification Results

| Gate | Exit | Result |
|------|------|--------|
| `npm run check` | 0 | clean |
| `npm test` | 0 | **167** unit (was 151) |
| `npm run build` | 0 | type-checks |
| `npm run test:integration` | 0 | **129** integration (was 120) |
| `CI=true npm run test:e2e` | 0 | **88** e2e (was 74) |

**384 tests total**, up from 345.

Plan-specific audits: no dependency added (`package.json` unchanged); no `"use client"` in any of
this plan's four source files; `lib/chart.ts` has zero imports; the placeholder copy is gone from
both `app/page.tsx` and `tests/e2e/home.spec.ts`.

Boundary audit — all verified unmodified: `prisma/schema.prisma`, `lib/aggregation.ts`,
`lib/consumption.ts`, `lib/money.ts`, `lib/reports.ts`, `lib/demo-data.ts`, `lib/seed-demo.ts`,
`app/cars/**`, `.github/workflows/ci.yml`, `playwright.config.ts`, `package.json`, `AGENTS.md`,
`CLAUDE.md`.

## Accomplishments

- **The scoping question was measured, and gave a different answer than last time.** For
  `getCarReport`, one filter did all the work and the other did none. For `getFleetSummary`,
  removing *either* fails nothing and removing *both* fails two tests — they are redundant with
  each other. Carrying 03-01's conclusion across would have been wrong in a way no test would
  have caught, since the code would still have been correct; the *reasoning* recorded for the
  next reader would have been false.
- **The chart's failure mode is invisible, so it was extracted and proven.** `value / max * height`
  with an all-zero series yields `NaN`, React writes `height="NaN"`, the browser drops the
  attribute, and the chart renders empty while nothing throws. `scaleBars` guards it, a unit test
  pins it, and the e2e asserts `height="NaN"` never appears in the served HTML.
- **Accessibility was treated as acceptance-level, not polish.** A bare `<svg>` of rectangles
  announces nothing; the chart carries `role="img"`, a descriptive `aria-label` naming the range
  and the peak month, and a `<title>` per bar. Two tests assert the accessible name.
- **Zero JavaScript shipped for the chart.** The e2e asserts against the raw HTTP response body
  rather than the hydrated DOM, so a client-rendered chart could not pass this suite.
- **The fleet total cross-checks against 03-01's independent path.** For a single-car account the
  roll-up must equal the car's own report; an integration test asserts exactly that, which is what
  would catch double-counting.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `lib/chart.ts` | Created | `scaleBars` — proportional heights, degenerate cases guarded |
| `lib/fleet.ts` | Created | `getFleetSummary` — three queries, grouped in JS, composing the existing pure modules |
| `app/monthly-chart.tsx` | Created | Server-rendered SVG bars with accessible naming |
| `app/page.tsx` | Rewritten | Placeholder → dashboard; now requires a session |
| `tests/unit/chart.test.ts` | Created | 13 tests, mostly degenerate cases |
| `tests/unit/monthly-chart.test.tsx` | Created | 5 tests; replaces the deleted page test |
| `tests/integration/fleet.test.ts` | Created | 9 tests including cross-user and the report cross-check |
| `tests/e2e/home.spec.ts` | Rewritten | 9 tests × 2 viewports, replacing 2 placeholder assertions |
| `tests/unit/page.test.tsx` | **Deleted** | Could not survive `/` becoming a server component |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Hand-rolled inline SVG | Twelve rectangles do not justify a client boundary or ~150KB; Phase 4 is a PWA where bundle size is a stated concern | No dependency; the chart works with JS disabled |
| `/` requires a session | Matches every other page; a public landing page would mean a second auth shape for no gain on a personal tool | `tests/e2e/home.spec.ts` fully rewritten |
| Both fleet scope filters kept | Measured as redundant with each other, but the cost of a later reader deleting the wrong "redundant" one is every user's spending on one dashboard | Documented in the module with the measurement |
| `scaleBars` as a module | The all-zero case fails silently and invisibly | Provable without a browser |
| Consumption omitted when null | "0.0 L/100km" asserts something false about a car with one fill-up | Consistent with 03-02's report treatment |
| Empty account shows no total | A €0.00 headline states as fact something simply not recorded yet | AC-8 asserts the absence, not just the invitation |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Out-of-scope file broken | 1 | Replaced rather than deleted, preserving its stated purpose |
| Self-corrections | 2 | A predicted result and a mis-scoped audit, both caught before the checkpoint |
| Process deviations | 1 | Applied a standing preference instead of re-asking |

### 1. `tests/unit/page.test.tsx` could not survive the change

- **Found during:** Task 3 qualify, when `npm test` exited 1 while reporting 162 passed
- **Issue:** The file rendered the placeholder home page under jsdom. The dashboard reads the
  session, so next-auth loads and cannot resolve `next/server` in that environment
- **Fix:** Replaced with `tests/unit/monthly-chart.test.tsx`. The original's own comment stated its
  purpose was proving the harness is wired — React 19, TypeScript, the JSX transform, jsdom, the
  `@/` alias — so that purpose is preserved by pointing at a component with no auth or database
  reach, and it gains genuine assertions about bar geometry, the `NaN` case, and accessible naming
- **Note:** Deleting it outright would have been the easier read of "the page it tested no longer
  exists", and would have quietly removed the only jsdom smoke test in the project

### 2. Mutation results were written before being measured

The `lib/fleet.ts` comment initially contained a *prediction* of what the mutations would show,
written while the code was fresh. Caught before qualify completed. All three mutations were then
run and the comment corrected to the measured outcome — which was more precise than the guess
(two tests fail when both filters go, not one, and the second is the soft-delete case rather than
another isolation case).

### 3. A mis-scoped audit

The first `"use client"` check grepped all of `app/` and reported eight hits — every one a
pre-existing Phase 2 form or delete button. The plan forbids *introducing* a client component, not
having any. Re-scoped to this plan's four files: all server components.

### 4. The dev server was stopped without asking

Third occurrence. The user had chosen this handling twice, the second time having been told
explicitly it would recur, so the standing preference was applied rather than putting the same
question a third time. Disclosed at the checkpoint with an offer to revert to asking each time.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `npm test` exit 1 while reporting all tests passed | A whole test *file* failed to load, so its tests were never counted. Read the exit code, not the summary line |
| Port 3000 held for a third time | Identified via the process tree (an overnight `npm run dev`), stopped per standing preference |
| The database was truncated by the integration suite | Known Phase 8 issue. The user's Google account row is gone and must be re-created by signing in again — flagged at the checkpoint |

## Next Phase Readiness

**Phase 3 is complete.** All three plans closed; the phase goal is exceeded — the original goal
named month/year and category costs, and the phase also shipped cost-per-kilometre, litres per
100 km, and a dashboard.

**Ready for Phase 4 (PWA & Mobile UX):**

- Every page is a server component and the app ships almost no client JavaScript, which is the
  best possible starting position for a PWA and a Lighthouse score.
- `/` is now a real entry point rather than a placeholder — an installed app has somewhere to land.
- The demo seed makes any mobile-UX work checkable against a populated account in one command.

**Concerns to carry forward:**

- **The database truncation problem is now costing real time.** It wiped the signed-in account
  twice in this session. Phase 8 exists for it; consider pulling it forward before Phase 4.
- **The dev server has blocked the e2e run three times.** A `PORT`-configurable Playwright config
  was offered and declined to keep scope clean; it remains a standing friction worth a small plan.
- **No accessibility audit has been run project-wide.** This plan added `role="img"`, `aria-label`
  and per-bar `<title>`, and 03-01 added section landmarks, but contrast, focus order and keyboard
  navigation remain unverified — and Phase 4 is the phase where that matters most.
- **STATE.md has drifted to ~187 lines against its own <100 target.** Trimmed as part of this
  transition; the full decision log lives in PROJECT.md.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 03-reporting, Plan: 03*
*Completed: 2026-08-10*
