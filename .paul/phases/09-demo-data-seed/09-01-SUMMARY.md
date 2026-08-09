---
phase: 09-demo-data-seed
plan: 01
subsystem: tooling
tags: [seed, cli, prisma, tsx, parseargs, determinism, fixtures, testing]

requires:
  - phase: 02-foundations
    provides: Car/Expense/Category/OdometerReading entities, the scoped data layer, NextAuth accounts
  - phase: 03-reporting
    provides: the report page the seeded data is verified against
provides:
  - "`npm run db:seed:demo` — twelve months of history attached to an existing account by email"
  - lib/demo-data.ts — the dataset as a pure, deterministic function of an anchor date
  - lib/seed-demo.ts — attach and clear, scoped to one user and one plate marker
  - A realistic fixture carrying the odometer edge cases 03-02 must survive
affects: [03-02-fuel-efficiency, 03-03-dashboard, 08-test-environment-safety]

tech-stack:
  added: []
  patterns:
    - "Pure dataset module split from its writer, so the data's shape is unit-testable DB-free"
    - "Seeds write through the real data layer, so the seed exercises production code paths"
    - "Destructive scoping proven by mutation, not by a passing suite"

key-files:
  created:
    - lib/demo-data.ts
    - lib/seed-demo.ts
    - prisma/seed-demo.ts
    - tests/unit/demo-data.test.ts
    - tests/integration/seed-demo.test.ts
    - tests/e2e/demo-seed.spec.ts
  modified:
    - package.json
    - CLAUDE.md
    - AGENTS.md

key-decisions:
  - "Attach to an existing user by email; never seed a User row, which would break Google sign-in"
  - "Write through lib/expenses.ts rather than createMany, so odometer linking is not duplicated"
  - "Re-running replaces the demo car silently, scoped to the DEMO-0001 marker"
  - "Dates anchor to today by default, --anchor pins them for deterministic tests"
  - "Clearing hard-deletes the demo car — a documented exception to the soft-delete rule"

patterns-established:
  - "A seed's dataset is worth testing harder than its inserts"
  - "Deliberately imperfect fixtures: a tidy series hides the bugs the calculation must survive"

duration: 20min
started: 2026-08-09T18:50:05Z
completed: 2026-08-09T19:09:51Z
description: "One command attaches twelve months of deterministic demo history to a signed-in account, written through the real data layer and carrying the odometer edge cases fuel-efficiency reporting must survive"
type: Summary
about: "gaspense"
---

# Phase 9 Plan 01: Demo Data Seed Summary

**`npm run db:seed:demo -- --email you@example.com` now turns a signed-in but empty account into
twelve months of vehicle history in about a second — 47 expenses, 30 odometer readings, and three
deliberate irregularities that exist so the next plan's maths gets tested against reality.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Started | 2026-08-09T18:50:05Z |
| Completed | 2026-08-09T19:09:51Z |
| Tasks | 4 of 4 (3 auto + 1 checkpoint) |
| Files created | 6 |
| Files modified | 3 |
| Tests added | 40 (20 unit, 12 integration, 8 e2e) |

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: One command populates an existing account | **Pass** | Integration test plus a real run: 47 expenses, 3 manual readings. Confirmed in the browser at the checkpoint |
| AC-2: Unknown email fails loudly, changes nothing | **Pass** | Throws with "sign in with Google once first"; asserts 0 users, 0 cars, 0 expenses afterwards. Also verified from the CLI |
| AC-3: Deterministic for a given anchor | **Pass** | Deep-equality on two builds; a database-level re-seed produces an identical total; comment-stripped audit finds no `Math.random`, `Date.now`, or bare `new Date()` |
| AC-4: Carries the edge cases 03-02 must survive | **Pass** | Exactly one partial fill, one fill with no reading, one decreasing reading — asserted in the dataset *and* re-asserted after the round trip through Postgres |
| AC-5: Re-running replaces only the demo car | **Pass** | A user-added `REAL-0001` car and its expense are re-read intact after two seeds; exactly one demo car exists, not two |
| AC-6: Cannot reach another user's data | **Pass** | Two users each holding a `DEMO-0001` car; seeding and clearing for one leaves the other's car and expense unchanged, re-read to prove it |
| AC-7: Clearing removes the car and its children | **Pass** | Car, expenses and readings all zero afterwards; other cars survive; a second clear is a safe no-op |
| AC-8: Seeded data renders in the app | **Pass** | e2e opens the report and asserts the hand-computed total, 12–13 month buckets, 2 year buckets, and Fuel leading the category breakdown |

## Verification Results

Every gate run fresh, exit codes captured directly rather than through a pipe:

| Gate | Exit | Result |
|------|------|--------|
| `npm run check` | 0 | clean |
| `npm test` | 0 | **125** unit (was 105) |
| `npm run build` | 0 | type-checks |
| `npm run test:integration` | 0 | **109** integration (was 97) |
| `CI=true npm run test:e2e` | 0 | **70** e2e (was 62) |

**304 tests total**, up from 264.

CLI behaviour verified by hand: no `--email` prints usage and exits 1; a malformed `--anchor`
is rejected before any write; seed, re-seed ("replaced"), clear, and a second clear ("nothing to
remove") all behave.

Boundary audit — all verified unmodified: `prisma/schema.prisma`, `prisma/migrations/`,
`lib/expenses.ts`, `lib/cars.ts`, `lib/odometer.ts`, `lib/money.ts`, `lib/seed-categories.ts`,
`prisma/seed.ts`, `app/**`, `.github/workflows/ci.yml`, `playwright.config.ts`. No new
dependency; no schema change. `AGENTS.md` edits confined to lines 52–75, well clear of the
`nextjs-agent-rules` markers at 122–130.

## Accomplishments

- **Two guards were mutation-proven rather than trusted.** Injecting `Math.random` into the
  dataset fails four tests; dropping `userId` from the demo-car delete filter fails the two-user
  test by destroying the wrong person's car. This module deletes rows, so a passing suite was not
  sufficient evidence that its scoping worked.
- **A real defect was caught before it could propagate.** `Math.round(x / 100)` silently made
  every fill a whole number of litres — 41 L, never 41.3 L. Nothing failed; the data merely looked
  slightly synthetic and would have made every consumption figure in 03-02 quietly less precise
  than the real thing. Fixed, with two tests pinning it: fractional litres, and a €/L ratio band
  that catches a scaling error in either field independently.
- **The seed writes through the real data layer.** Roughly fifty round trips instead of two, and
  worth it: the `expenseId` / `source: EXPENSE` / matching-date pairing stays owned by
  `createExpense` rather than being duplicated, and the seed cannot construct states the
  application itself never produces. Asserted directly — 27 linked readings, 3 manual.
- **A standing concern closed as a side effect.** The checkpoint required a Google sign-in, which
  had never been performed on this project. Verified in the database afterwards: a `User` row with
  a linked `Account` of provider `google`.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `lib/demo-data.ts` | Created | The dataset as a pure function of an anchor. Zero imports |
| `lib/seed-demo.ts` | Created | `seedDemoData` / `clearDemoData`, scoped to one user and the plate marker |
| `prisma/seed-demo.ts` | Created | Thin runner: `parseArgs`, `--email` / `--anchor` / `--clear` |
| `tests/unit/demo-data.test.ts` | Created | 20 tests — determinism, edge-case counts, plausibility |
| `tests/integration/seed-demo.test.ts` | Created | 12 tests — attach, replace, clear, cross-user isolation |
| `tests/e2e/demo-seed.spec.ts` | Created | 4 tests × 2 viewports — seeded data rendering |
| `package.json` | Modified | `db:seed:demo` script |
| `CLAUDE.md` | Modified | Command table + demo-data section |
| `AGENTS.md` | Modified | Same, in the same commit |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Attach by email; never seed a `User` | Google sign-in against a user with no linked `Account` is refused with `OAuthAccountNotLinked` — seeding first breaks login outright | The command stays entirely out of the auth path |
| Write through the data layer, not `createMany` | The odometer↔expense pairing is owned by `createExpense`; a second copy would drift | Slower seed; a regression in the write path breaks the seed loudly |
| `lib/seed-demo.ts` uses the Prisma singleton | It calls singleton-bound data-layer functions. An injected client for lookups plus the singleton for writes could address two different databases | Differs from `lib/seed-categories.ts` deliberately, and says so in a comment |
| Replace silently on re-run | The common case is re-seeding after truncation, where nothing exists to replace and a flag is pure friction | Scoped to `DEMO-0001`; a real car can never be caught |
| Hard-delete on `--clear` | The soft-delete rule protects real history; undoing a seed is not that. Soft-deleting would leave every re-seed's corpse in the database | A documented exception, justified in the code |
| Anchor to today, `--anchor` to pin | Dev runs always populate the current month; tests pin and assert exact totals | Both properties needed, neither alone sufficient |
| Deliberately imperfect data | A tidy series would hide the bugs 03-02 must survive | The irregularity indices are exported constants, so tests and dataset cannot drift |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Defects found and fixed | 1 | Caught before it could mislead 03-02 |
| Test corrections | 3 | My assertions were wrong, not the code |
| Scope additions | 1 | Removed a false statement from the agent docs |
| Blocked episodes | 1 | Resolved with the user |

**Total impact:** No scope creep. The one addition corrects a documented falsehood.

### 1. Whole-litre defect in the dataset

- **Found during:** Task 1 qualify, while auditing a `/ 100` that looked like a money conversion
- **Issue:** `Math.round(pick(...) / 100)` produced integer litres on every fill. Nothing failed —
  the data was merely subtly unrealistic, and 03-02's consumption figures would have inherited it
- **Fix:** Pick tenths and scale by a named `TENTHS_PER_LITER`, with `amountCents` rounded after
  multiplication. Added two tests: fractional litres present on most fills, and every fill's
  implied €/L inside a plausible band
- **Note:** The `/ 100` was also misleading on its face, since `lib/money.ts` is meant to be the
  only place `/ 100` appears. The replacement constant removes that ambiguity

### 2. Three test corrections (my error, not the code's)

- **Unscoped `fullTank: false` count** expected 1, got 20. The 19 non-fuel expenses legitimately
  store `false` — the form's schema coerces an absent checkbox to `false` rather than `null`, and
  the seed matches the app rather than inventing a third state. Assertion scoped to fuel rows
- **Guessed an `<h2>` on the cars list** that does not exist; the nickname is a `span`. Rewritten
  against the actual markup rather than adding a heading to satisfy a guess
- **`import.meta.url` is not a `file:` URL under jsdom**, so the source-audit test now resolves
  from `process.cwd()`

### 3. Scope addition — removed a false claim from both agent files

CLAUDE.md and AGENTS.md both still said *"Supabase and NextAuth arrive in later Phase 2 plans
(02-03 and 02-04); there is no database or auth yet."* Flatly untrue since Phase 2 and actively
misleading to any agent reading it, in the exact paragraph being edited. Replaced in both files,
in the same commit, per the standing rule.

### 4. Blocked — port 3000 held by the user's dev server

`CI=true npm run test:e2e` refuses to reuse an existing server, correctly. The occupant was a
71-minute-old `npm run dev`, not a stale test orphan — identified through the process tree rather
than killed on sight. Surfaced to the user, stopped with their agreement, e2e run, and the fact
that the dev server needs restarting reported back.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `tsx -e` scratch script failed silently | `lib/prisma.ts` does not load dotenv; bare scripts need `import "dotenv/config"`, which is why `prisma/seed-demo.ts` has it. My ad-hoc command was at fault, not the code |
| e2e failed on first run (2 of 70) | Wrong locator in the new spec. Fixed the test |

## Next Phase Readiness

**Ready for 03-02 (fuel efficiency):**

- A populated account exists on demand, so 03-02 can be developed and eyeballed without hand-
  building anything.
- The fixture is deliberately awkward: one partial fill, one fill with no reading, one reading
  lower than its predecessor, and ~25 clean consecutive full-tank pairs. `PARTIAL_FILL_INDEX`,
  `MISSING_READING_INDEX` and `DECREASING_READING_INDEX` are exported, so 03-02's tests can
  reference the same constants rather than rediscovering them.
- The decreasing reading is a transposed digit, not a replaced odometer — the following fill
  returns to the true series, which is the harder case.

**Concerns to carry forward:**

- **Running `npm run test:integration` still wipes the demo data.** Left to Phase 8 deliberately.
  Documented in both agent files so it reads as known rather than broken.
- **03-02 must carry its own ownership read**, per 03-01's mutation finding. Unchanged by this
  plan.
- The demo car is identified by its licence plate rather than a column. If a user ever names a
  real car `DEMO-0001`, re-seeding would replace it. Acceptable for a developer command; a schema
  flag would have meant a migration for no real gain.

**Blockers:** None. Phase 3 resumes at 03-02.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 09-demo-data-seed, Plan: 01*
*Completed: 2026-08-09*
