---
phase: 03-reporting
plan: 01
subsystem: reporting
tags: [aggregation, prisma, nextjs, vitest, playwright, money, timezone, a11y]

requires:
  - phase: 02-foundations
    provides: Expense/Car/Category entities, scoped data-layer pattern, lib/money.ts, e2e auth helpers
provides:
  - Per-car cost report at /cars/[id]/report (all-time, yearly, monthly, by-category)
  - lib/aggregation.ts — dependency-free bucketing module, unit-testable without a database
  - lib/reports.ts — scoped report query composing the aggregation module
affects: [03-02-fuel-efficiency, 03-03-dashboard, 07-maintenance-reminders]

tech-stack:
  added: []
  patterns:
    - "Pure calculation module split from its scoped query, so the arithmetic is unit-testable DB-free"
    - "UTC date bucketing proven under non-UTC TZ rather than asserted"
    - "aria-label on report sections as landmarks, doubling as unambiguous test scope"

key-files:
  created:
    - lib/aggregation.ts
    - lib/reports.ts
    - app/cars/[id]/report/page.tsx
    - tests/unit/aggregation.test.ts
    - tests/integration/reports.test.ts
    - tests/e2e/reports.spec.ts
  modified:
    - app/cars/[id]/expenses/page.tsx

key-decisions:
  - "Aggregate in JavaScript, not SQL date_trunc — keeps the UTC rule reachable from unit tests"
  - "Ownership resolved by a getCarById pre-check, so 'not yours' is distinguishable from 'nothing logged yet'"
  - "Periods with no expenses are absent, not zero-filled"
  - "Categories grouped by id, not name — a user may own a category sharing a system category's name"

patterns-established:
  - "Mutation-test the isolation guard rather than trusting that a passing suite proves it"
  - "Prove timezone-sensitive logic by running the assertion under a timezone that disagrees with UTC"

duration: 21min
started: 2026-08-09T17:34:07Z
completed: 2026-08-09T17:55:31Z
description: "Per-car cost reporting — all-time, yearly, monthly and by-category totals over a DB-free aggregation module behind a scoped query"
type: Summary
about: "gaspense"
---

# Phase 3 Plan 01: Cost Aggregations Summary

**A car's expense history now totals itself: all-time, per year, per month, and per category,
computed in integer cents by a module with zero imports and rendered at `/cars/[id]/report`.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~21 min |
| Started | 2026-08-09T17:34:07Z |
| Completed | 2026-08-09T17:55:31Z |
| Tasks | 4 of 4 (3 auto + 1 checkpoint) |
| Files created | 6 |
| Files modified | 1 |
| Tests added | 36 (20 unit, 8 integration, 8 e2e) |

Against the phase-3 plan-split decision: 21 minutes for one vertical slice, versus 195 for
02-07's three. The split paid for itself on the first plan.

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: Totals correct, summed as integers | **Pass** | 4520+1205+7 = 5732 asserted in unit *and* integration; comment-stripped audit shows 0 `formatEur` calls in `lib/aggregation.ts` and `lib/reports.ts`, 3 in the page |
| AC-2: UTC bucketing matches display | **Pass** | Proven, not asserted: cases run under `America/New_York` and `Asia/Tokyo` where `getMonth()` demonstrably disagrees with UTC; a third case cross-checks against the expense list's own `Intl` formatter |
| AC-3: Only non-empty periods, newest first | **Pass** | Unit test on a March/June gap; integration test asserts exact key order `["2026-06","2026-03","2026-01","2025-12"]`; e2e asserts Apr/May have count 0 |
| AC-4: Category breakdown named and ranked | **Pass** | Ranked desc with name-ascending tie-break; unused seeded category absent; e2e asserts row order `[Fuel, Maintenance]` |
| AC-5: No report for another user's car | **Pass** | Returns null, and the victim's expenses are re-read afterwards intact (1 row, 9900 cents) — the weaker assertion alone would pass on an always-null function |
| AC-6: Soft-deleted car has no report | **Pass** | Returns null while `expense.count` for that car remains 1 |
| AC-7: Renders on mobile, reachable from the car | **Pass** | 4 e2e tests × desktop and mobile projects, navigating via the new link |
| AC-8: Empty car reports zero, not an error | **Pass** | `{ totalCents: 0, byYear: [], byMonth: [], byCategory: [] }`; e2e asserts €0.00 plus three empty-state strings |

## Verification Results

All gates run fresh with exit codes captured directly, never through a pipe:

| Gate | Exit | Result |
|------|------|--------|
| `npm run check` | 0 | docs + prettier + eslint + markdownlint clean |
| `npm test` | 0 | **105** unit (was 85) |
| `npm run build` | 0 | `/cars/[id]/report` present in the route table |
| `npm run test:integration` | 0 | **97** integration (was 89) |
| `CI=true npm run test:e2e` | 0 | **62** e2e (was 54) |

**264 tests total**, up from 228.

Boundary audit: `prisma/schema.prisma`, `prisma/migrations/`, `app/page.tsx`,
`tests/e2e/home.spec.ts`, `lib/money.ts`, `lib/expenses.ts`, `lib/cars.ts`, `lib/odometer.ts`,
`package.json`, `.github/workflows/ci.yml` and `AGENTS.md` all verified unmodified. No new
dependency; no schema change.

## Accomplishments

- **The isolation guard was mutation-tested rather than assumed.** Removing the `getCarById`
  pre-check fails 3 tests; removing the `car: ownedCar(userId)` relation filter fails **none**.
  That inverts the expectation carried over from `lib/expenses.ts` — here the pre-check is what
  enforces isolation and the relation filter is defence in depth. Recorded in the module comment
  so a later reader does not delete the pre-check believing the filter covers it; the result
  would be a stranger's car reporting €0.00 instead of 404, leaking existence rather than
  producing a visible error.
- **The UTC rule is proven in CI, not asserted.** Node 24 re-reads `process.env.TZ` at runtime,
  so the tests actually execute under timezones where local time and UTC disagree about the
  month. Asserted against the default timezone this rule would have been vacuous in CI, which
  runs UTC — a test that could never fail.
- **The money boundary held end to end.** Zero euro conversions above the view layer, verified
  against comment-stripped source rather than a raw grep.
- **`lib/aggregation.ts` has no imports at all**, which is a stronger proof of database
  independence than running the suite with the container stopped.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `lib/aggregation.ts` | Created | Pure bucketing: `totalCents`, `byYear`, `byMonth`, `byCategory`. Zero imports |
| `lib/reports.ts` | Created | `getCarReport(userId, carId)` — scoped query, flattens to plain rows, composes the above |
| `app/cars/[id]/report/page.tsx` | Created | Server component; three labelled sections plus the all-time total |
| `tests/unit/aggregation.test.ts` | Created | 20 tests including the two non-UTC timezone cases |
| `tests/integration/reports.test.ts` | Created | 8 tests; every cross-user case re-reads the victim's rows |
| `tests/e2e/reports.spec.ts` | Created | 4 tests × 2 viewport projects |
| `app/cars/[id]/expenses/page.tsx` | Modified | "Report" link beside "Odometer log" |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Aggregate in JS, not SQL `date_trunc` | Keeps the UTC bucketing rule reachable from unit tests with no database | Fine at personal scale; swap for `groupBy` behind the same signature if a car ever holds enough rows to matter |
| Ownership via a `getCarById` pre-check | An empty result cannot distinguish "not your car" from "car with nothing logged" — AC-8 needs that distinction | 03-02/03-03 must carry their own ownership read; the query filter alone will not refuse |
| Empty periods absent, not zero-filled | A "€0.00" row asserts a month was tracked and cost nothing, which is a different claim from "nothing was logged" | 03-03's charts must zero-fill themselves if they want a continuous axis |
| Categories grouped by id, not name | A user may create their own "Fuel" alongside the system one; grouping by name would merge private spend into the shared row | Holds for any later per-category work |
| `aria-label` on each report section | Three unlabelled lists of numbers are indistinguishable to a screen reader | Also gives tests an unambiguous scope; adopt for 03-03's dashboard sections |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Plan-text corrections | 2 | Verification steps were wrong as written; code unaffected |
| Scope additions | 2 | Both small, both justified below |
| Deferred | 0 | — |

**Total impact:** No scope creep. Two of the four are corrections to the plan's own verification
instructions rather than changes to what was built.

### 1. The plan's grep verification was wrong as written

- **Found during:** Task 1 qualify
- **Issue:** The plan specified `grep -n "prisma\|generated" lib/aggregation.ts` "returns
  nothing". It returned three matches — all of them prose inside comments explaining that the
  file deliberately imports no Prisma client.
- **Fix:** Replaced with a comment-stripped audit, per the standing lesson from 02-05. Result:
  0 code references, 0 import statements.
- **Note:** This is the same failure mode 02-05 recorded, reappearing in a plan written after it.
  Worth treating "grep for absence" as always requiring comment-stripping.

### 2. DB-freedom proven statically rather than by stopping Docker

- **Found during:** Task 1 qualify
- **Issue:** The plan said to run `npm test` with Docker stopped. The user's container had been
  running two days, and stopping it is an avoidable disturbance.
- **Fix:** Proved the stronger property instead — `lib/aggregation.ts` contains **zero import
  statements**, so it cannot reach a database by any path. A green suite with the container down
  is weaker evidence than that.

### 3. Scope addition — `aria-label` on report sections

- **Found during:** Task 3, first e2e run (2 failures)
- **Issue:** `getByText("€57.32")` matched two elements. Not a bug: with every expense in one
  year, the yearly row legitimately equals the all-time total.
- **Fix:** Made each section a labelled landmark. Kept because it is a genuine accessibility
  improvement against the project's stated WCAG AA goal, not merely a test hook.
- **Also corrected:** the same test asserted month figures under a "By category" comment. Category
  totals are Fuel €57.25 / Maintenance €0.07; the assertions now match the section they sit in.

### 4. Scope addition — the link edit wrapped both links in a flex container

- **Found during:** Task 3
- **Issue:** Inserting a bare sibling `<Link>` stacked it under "Odometer log".
- **Fix:** Wrapped both in `flex items-center gap-4`. Confirmed by grepping for the `/report`
  href and reading the surrounding block in full — the specific check the plan demanded, because
  02-07's silent no-op replace passed a green build.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| e2e failed on first run (2 of 62) | Ambiguous locator in the new spec, not an app defect. Fixed by scoping assertions to labelled sections |
| `npm run check` failed on formatting | Prettier disagreed with the new test file's line wrapping. Ran `prettier --write`, re-ran the gate to exit 0 |

## Documentation Nit Found

`.paul/PROJECT.md` records **53** e2e tests at the end of Phase 2. The actual baseline was **54**
(27 unique specs × 2 viewport projects). Off by one before this plan and not caused by it —
corrected in the Phase 2 tallies when PROJECT.md is next evolved.

## Next Phase Readiness

**Ready for 03-02 (fuel efficiency):**

- `lib/aggregation.ts` is the established home for pure calculation, and the pattern for proving
  it (DB-free unit tests, timezone-explicit cases) is set.
- `getCarReport` is the surface to extend; the report page has an obvious slot for L/100km and
  cost-per-km beneath the total.
- The odometer series it needs is already linked to its expense via `OdometerReading.expenseId`
  (02-07), and `Expense.fullTank` marks usable endpoints.

**Concerns to carry forward:**

- **03-02 must not assume the relation filter isolates it.** Whatever query it adds needs its own
  ownership read, exactly as `getCarReport` does — see the mutation result above.
- **The odometer series is deliberately not monotonic.** Readings may decrease, repeat, or be
  absent on a given fill-up. 03-02's consumption maths must survive that rather than assume an
  ascending series, and should reuse the TZ-explicit test technique for any date arithmetic.
- **03-03 still owns `/` and `tests/e2e/home.spec.ts`.** Both untouched here, so the known
  placeholder-copy assertion is still live and will need updating then, as expected.
- No accessibility audit has been run project-wide; the `aria-label` work here is a point
  improvement, not a substitute.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 03-reporting, Plan: 01*
*Completed: 2026-08-09*
