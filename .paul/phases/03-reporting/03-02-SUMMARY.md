---
phase: 03-reporting
plan: 02
subsystem: reporting
tags: [consumption, fuel-efficiency, cost-per-km, money, floating-point, mutation-testing]

requires:
  - phase: 03-reporting
    provides: the report page and the pure-module-behind-a-scoped-query pattern (03-01)
  - phase: 09-demo-data-seed
    provides: the deliberately awkward twelve-month fixture this was developed against
provides:
  - lib/consumption.ts — full-to-full interval logic, pure and import-free
  - getCarEfficiency in lib/reports.ts — the scoped query, with its own ownership check
  - formatEurPerKm in lib/money.ts — the only money-per-distance division
  - An Efficiency section on /cars/[id]/report, with the intervals listed
affects: [03-03-dashboard, 07-maintenance-reminders]

tech-stack:
  added: []
  patterns:
    - "Rounding money-derived rates in integer space, never via toFixed"
    - "Audits must carry a positive control or they prove nothing"
    - "Mutation-test each rule that guards against a plausible-looking wrong number"

key-files:
  created:
    - lib/consumption.ts
    - tests/unit/consumption.test.ts
    - tests/integration/efficiency.test.ts
  modified:
    - lib/reports.ts
    - lib/money.ts
    - app/cars/[id]/report/page.tsx
    - tests/unit/money.test.ts
    - tests/e2e/reports.spec.ts
    - tests/e2e/demo-seed.spec.ts

key-decisions:
  - "Full-to-full method: partial fills are absorbed into the interval, never used as endpoints"
  - "A backwards reading invalidates its own endpoint, leaving the interval open"
  - "The average is distance-weighted, not the mean of per-interval rates"
  - "formatEurPerKm rounds in integer space at three decimals, inside lib/money.ts"
  - "Cost-per-km divides by the span of credible readings, immune to a mis-keyed low value"

patterns-established:
  - "Show the working: the interval list is what makes an unverifiable average checkable"
  - "A calculation whose failures look plausible needs mutation testing, not a green suite"

duration: 17min
started: 2026-08-09T19:25:05Z
completed: 2026-08-09T19:42:29Z
description: "Litres per 100 km from full-to-full intervals, plus fuel and total cost per km, over an odometer series with gaps, partial fills and a reading that goes backwards"
type: Summary
about: "gaspense"
---

# Phase 3 Plan 02: Fuel Efficiency Summary

**The report now says what the car actually uses — 7.0 L/100km across 24 full-to-full intervals,
€0.131 per kilometre in fuel and €0.268 all-in — computed over a year of data containing a
partial fill, a fill with no odometer reading, and a reading that goes backwards.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~17 min |
| Started | 2026-08-09T19:25:05Z |
| Completed | 2026-08-09T19:42:29Z |
| Tasks | 4 of 4 (3 auto + 1 checkpoint) |
| Files created | 3 |
| Files modified | 6 |
| Tests added | 41 (26 unit, 11 integration, 4 e2e) |

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: Full-to-full, partials absorbed | **Pass** | 1,400 km on 41.2 + 22.5 + 44.0 = 107.7 L → 7.6929 L/100km, asserted in unit and integration. Mutation: dropping partial litres fails 2 tests |
| AC-2: A reading-less fill is not an endpoint but its litres count | **Pass** | One interval spanning three fills, 95 L over 2,000 km |
| AC-3: A partial fill is never an endpoint, even carrying a reading | **Pass** | Asserted with a partial at 100,500 between endpoints at 100,000 and 101,000. Mutation: allowing it fails 2 tests |
| AC-4: A backwards reading invalidates itself, not the series | **Pass** | 155,986 → 155,212 → 156,998 yields one interval of 1,012 km carrying both fills' litres. Mutation: closing there fails 6 tests |
| AC-5: Fuel and total cost per km, separately | **Pass** | €0.131 vs €0.268 on the seeded year; integration asserts fuel 14,000 and total 62,000 cents |
| AC-6: Distance from usable readings only | **Pass** | A mid-series low reading is ignored; raw min/max would have given 12,000 km instead of 10,000 |
| AC-7: Not-enough-data explains itself | **Pass** | Never "0.0 L/100km"; e2e asserts the explanatory copy and asserts the zero strings have count 0 |
| AC-8: Money never divides outside lib/money.ts | **Pass** | Comment-stripped audit **with a positive control**: `money.ts` 2 hits, `reports.ts` 0, page 0. The one hit in `consumption.ts` is litres÷km, not money |
| AC-9: Efficiency unreachable for another user's car | **Pass** | Returns null; Bob's expenses re-read intact. Mutation: removing the pre-check fails 3 tests |

## Verification Results

Every gate run fresh with exit codes captured directly, never through a pipe:

| Gate | Exit | Result |
|------|------|--------|
| `npm run check` | 0 | clean |
| `npm test` | 0 | **151** unit (was 125) |
| `npm run build` | 0 | type-checks |
| `npm run test:integration` | 0 | **120** integration (was 109) |
| `CI=true npm run test:e2e` | 0 | **74** e2e (was 70) |

**345 tests total**, up from 304.

Boundary audit — all verified unmodified: `prisma/schema.prisma`, `prisma/migrations/`,
**`lib/demo-data.ts`**, `lib/seed-demo.ts`, `lib/aggregation.ts`, `lib/expenses.ts`,
`lib/cars.ts`, `lib/odometer.ts`, `app/page.tsx`, `tests/e2e/home.spec.ts`,
`.github/workflows/ci.yml`, `playwright.config.ts`, `package.json`, `AGENTS.md`. The
`lib/money.ts` change is purely additive — no lines removed, so `formatEur` is untouched.

## Accomplishments

- **Five rules mutation-proven rather than trusted.** Partial-as-endpoint (2 tests fail),
  partial litres dropped (2), closing on a backwards reading (6), naive-mean average (1), and the
  ownership pre-check (3). Every one of these guards against a wrong number that *looks right*,
  which is exactly the class a passing suite cannot vouch for on its own.
- **A defect found in this plan's own new code.** `toFixed(3)` made rounding depend on the
  floating-point representation: `(21350/100/1000).toFixed(3)` returns `"0.213"`, not `"0.214"`,
  because the nearest double sits just below the half-way point. The result was neither
  round-half-up nor round-half-even but "whatever the binary happened to be". Rewritten to round
  thousandths as an integer. This is the same class of surprise `formatEur` was hand-rolled to
  avoid — reintroduced one function away from it.
- **An audit caught being vacuous.** The first AC-8 money-division check reported zero hits in
  every file, *including* `lib/money.ts`, which unquestionably contains the division. Rewritten
  with a positive control before its result was accepted.
- **The numbers are checkable by a human**, which was the design goal. The interval list turns an
  unverifiable average into arithmetic anyone can redo: 54.5 L over 573 km → 9.5 L/100km.
- **24 intervals from 28 fills** is exactly right — 27 possible, minus the three deliberate
  irregularities, each absorbed rather than breaking the series.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `lib/consumption.ts` | Created | Full-to-full intervals, weighted average, credible-reading span. Zero imports |
| `tests/unit/consumption.test.ts` | Created | 19 tests, including the fixture run end to end |
| `tests/integration/efficiency.test.ts` | Created | 11 tests — query fidelity, isolation, the seeded year |
| `lib/reports.ts` | Modified | `getCarEfficiency` with its own ownership pre-check; corrected a stale comment |
| `lib/money.ts` | Modified | `formatEurPerKm`, integer-rounded, three decimals |
| `app/cars/[id]/report/page.tsx` | Modified | Efficiency section with the interval list |
| `tests/unit/money.test.ts` | Modified | 7 tests for the new formatter |
| `tests/e2e/reports.spec.ts` | Modified | The not-enough-data case |
| `tests/e2e/demo-seed.spec.ts` | Modified | Consumption rendering against the seeded year |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Partial fills absorbed, never endpoints | The fuel was burned over that distance; dropping it undercounts by ~20% and reads as an efficient car | 03-03 charts what this produces |
| Backwards reading leaves the interval open | A transposed digit is far more common than a replaced odometer, and the next fill rejoins the true series | Closing there would give one negative and one inflated interval |
| Distance-weighted average | The mean of rates weights a 40 km interval like a 900 km one | Asserted explicitly against the naive mean so a "simplification" fails |
| Fills before the first endpoint are discarded | Their fuel covered an unknown distance | Slightly fewer litres counted, no inflated first interval |
| `formatEurPerKm` in `lib/money.ts`, 3 dp, integer rounding | Money ÷ distance is money changing unit; two decimals collapse figures that differ 2× | 03-03 reuses it rather than re-deriving a rate |
| Credible-reading span for cost-per-km | A mis-keyed low reading would otherwise become the series start | Documented limitation: an anomalous *first* reading still collapses the span |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Defects found and fixed | 1 | In this plan's own new code, caught before the checkpoint |
| Verification corrections | 1 | An audit that could not fail |
| Scope additions | 1 | A stale comment corrected in a file already being edited |
| Blocked episodes | 1 | Resolved with the user |

**Total impact:** No scope creep. The plan's tasks were executed as written.

### 1. `toFixed` rounding defect in `formatEurPerKm`

- **Found during:** Task 3, by a test asserting half-way rounding
- **Issue:** `toFixed` rounds according to the double's actual value, so `€0.2135` became
  `€0.213`. Not a stated rule, and unpredictable per input
- **Fix:** Round `cents * 10 / km` to an integer number of thousandths, then build the string from
  integer parts — matching how `formatEur` already works, and why

### 2. The AC-8 audit was vacuous as first written

- **Found during:** Task 3 qualify
- **Issue:** The regex matched no money division in any file, including `lib/money.ts`. A check
  that cannot detect the thing it looks for is not a check
- **Fix:** Rewritten to match `/ km`, `/ distanceKm`, `/ MINOR_UNITS_PER_EURO`, with `money.ts` as
  a positive control that must report a non-zero count

### 3. Scope addition — corrected a stale comment in `getCarReport`

The comment read "The relation filter is what does the real work", directly contradicting the
block above it, which 03-01 rewrote after mutation testing showed the opposite. Two lines, in a
file already being edited, removing an actively misleading statement about where isolation lives.

### 4. Blocked — port 3000 held by the user's dev server, for the second time

Identified through the process tree rather than killed on sight: a deliberately-restarted
`npm run dev`, not a stale test orphan. Raised with the user rather than reusing the permission
given in 09-01, since that applied to a different instance. Offered a permanent fix (a
configurable Playwright port) and the user chose to keep this plan's scope clean instead.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| e2e blocked twice by an occupied port | Not a test failure. Surfaced, then cleared with permission |

## Next Phase Readiness

**Ready for 03-03 (dashboard):**

- The consumption series is returned as `intervals`, already in a shape a chart can plot —
  dated endpoints, distance, litres and a rate per interval.
- `formatEurPerKm` exists for any rate the dashboard wants to show.
- Both report queries (`getCarReport`, `getCarEfficiency`) carry their own ownership check, so a
  fleet roll-up can call them per car without inventing a new scoping shape.

**Concerns to carry forward:**

- **03-03 must still carry its own ownership read** for any *new* query shape it introduces —
  particularly the all-cars roll-up, which is the first query in the project not scoped to a
  single car id. The mutation finding does not transfer automatically to a different query shape.
- **`/` and `tests/e2e/home.spec.ts` remain untouched**, so the placeholder assertion is still
  live and will need updating in 03-03. Expected, not a regression.
- **Known limitation, stated in the code:** if the *earliest* reading is anomalously high, the
  credible-reading filter discards everything after it and the cost-per-km span collapses. The
  alternative would be guessing which end is wrong, which means inventing data.
- **The efficiency figures are all-time only.** Per-period consumption ("this month vs last") was
  deliberately excluded and belongs with 03-03's period filtering, if it earns its place.

**Blockers:** None. Phase 3 finishes at 03-03.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 03-reporting, Plan: 02*
*Completed: 2026-08-09*
