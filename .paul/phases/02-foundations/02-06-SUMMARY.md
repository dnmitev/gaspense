---
phase: 02-foundations
plan: 06
subsystem: ui
tags: [prisma, zod, nextjs, server-actions, money, playwright, vitest]

requires:
  - phase: 02-foundations (02-05)
    provides: the vertical-slice pattern, scoped data layer conventions, e2e session helper
  - phase: 02-foundations (02-04)
    provides: requireUserId() and database sessions
provides:
  - Expense CRUD scoped through car ownership
  - lib/money.ts — the single euro↔cent conversion point
  - Separate fuel and other expense entry points
  - listVisibleCategories (read-only category access)
affects: [02-07, phase-3-reporting, phase-7-maintenance]

tech-stack:
  added: []
  patterns:
    - "Relation-scoped writes for entities with no userId column"
    - "Explicit ownership pre-check before create (no WHERE on insert)"
    - "Single-module unit conversion, enforced by source audit"

key-files:
  created:
    - lib/money.ts
    - lib/expenses.ts
    - lib/validation/expense.ts
    - lib/validation/shared.ts
    - app/cars/[id]/expenses/**
    - tests/e2e/helpers/categories.ts
  modified:
    - app/cars/page.tsx
    - lib/seed-categories.ts
    - docs/ARCHITECTURE.md

key-decisions:
  - "lib/money.ts is the only euro↔cent converter, tests included"
  - "Parse amounts from the string, not parseFloat — so 2-decimal precision is a check, not an accident"
  - "Amount input is type=text inputMode=decimal, never type=number"
  - "Fuel and other expenses get separate entry points; only visibility branches, never validation"
  - "The form may name-match the seeded Fuel category because system rows cannot be renamed"

patterns-established:
  - "Entities without a userId scope through their parent relation in every query"
  - "create() needs an explicit ownership pre-check; it is the one place scoping is not a filter"
  - "e2e suites seed their own global fixtures rather than relying on leftover state"

duration: 47min
started: 2026-08-08T05:22:53Z
completed: 2026-08-08T06:09:40Z
description: "Expense CRUD scoped through car ownership, over a single audited euro↔cent helper, with separate fuel and other entry points"
type: Summary
about: "gaspense"
---

# Phase 2 Plan 06: Expense CRUD + Money Helper — Summary

**Gaspense now does the thing it exists for: a user records what a car actually
costs, in euros, and the number survives the round trip.**

## Performance

| Metric         | Value                                        |
| -------------- | -------------------------------------------- |
| Duration       | ~47 min (plan created → loop closed)         |
| Started        | 2026-08-08T05:22:53Z                         |
| Completed      | 2026-08-08T06:09:40Z                         |
| Tasks          | 7 completed (6 planned + 1 added at review)  |
| Files          | 15 created, 3 modified                       |
| Tests          | 161 total (73 unit, 52 integration, 36 e2e)  |

## Acceptance Criteria Results

| Criterion                                     | Status | Evidence                                                                                    |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| AC-1: One audited euro↔cent converter        | Pass   | Comment-stripped audit of `lib/`, `app/`, `tests/` finds no bare `/100` or `*100`; round-trip property holds across 13 values |
| AC-2: Record an expense in euros              | Pass   | e2e enters "45.20", list renders "€45.20"; integration asserts `amountCents === 4520`        |
| AC-3: Invalid amounts rejected, not coerced   | Pass   | `""`, `"0"`, `"-5"`, `"abc"`, `"12.345"` each rejected with a readable message; `"12,34"` → 1234 |
| AC-4: Forged carId cannot attach an expense   | Pass   | `createExpense` returns null, `expense.count()` is 0, victim's list unchanged                |
| AC-5: Read/update/delete scoped through car   | Pass   | Each cross-user test re-reads the victim's row and asserts it unmodified                     |
| AC-6: Soft-deleted car hides but keeps rows   | Pass   | List empty, route 404s in e2e, `expense.count()` still 1                                     |
| AC-7: Works end to end on mobile              | Pass   | 36 e2e across desktop-chromium and Pixel 7                                                   |
| AC-9: Separate fuel and other entry points    | Pass   | Added at the checkpoint; fuel form preselects the system Fuel category, other form keeps the fields collapsed but reachable |
| AC-8: Full gate green                         | Pass   | check 0 · build 0 · unit 0 · integration 0 · e2e 0 (`CI=true`); CI success on `e8b6a2a`      |

## What Was Built

| File                                         | Lines | Purpose                                                                 |
| -------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `lib/money.ts`                               | 101   | The only place euros and cents convert                                  |
| `lib/expenses.ts`                            | 138   | Scoped data layer — every filter reaches through the `car` relation      |
| `lib/validation/expense.ts`                  | 87    | Zod schema producing `amountCents`; readable message on a bad amount     |
| `lib/validation/shared.ts`                   | 24    | `optionalText`, shared by the new schemas                               |
| `app/cars/[id]/expenses/actions.ts`          | 113   | Server actions, each opening with `requireUserId()`                     |
| `app/cars/[id]/expenses/page.tsx`            | 123   | List with per-car total and two entry points                            |
| `app/cars/[id]/expenses/expense-form.tsx`    | 240   | One form, two presentations (fuel expanded / other collapsed)           |
| `app/cars/[id]/expenses/new/page.tsx`        | 61    | Reads `?type=fuel`, preselects the system Fuel category                 |
| `.../[expenseId]/edit/page.tsx`              | 67    | Seeds the amount via `formatAmountInput`, never raw cents               |
| `.../delete-expense-button.tsx`              | 35    | Hard delete, and says so                                                |
| `tests/unit/money.test.ts`                   | 113   | 17 tests including the round-trip property                              |
| `tests/unit/validation-expense.test.ts`      | 198   | 23 tests                                                                |
| `tests/integration/expenses.test.ts`         | 392   | 22 tests, every leakage case re-reading the victim's row                |
| `tests/e2e/expenses.spec.ts`                 | 201   | 10 scenarios × 2 devices                                                |
| `tests/e2e/helpers/categories.ts`            | 28    | Seeds the system categories the suite depends on                        |

## Decisions Made

| Decision                                                  | Rationale                                                                                                                             | Impact                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `lib/money.ts` is the only converter, tests included      | A missed ÷100 is a 100× error that crashes nothing and just makes the report wrong                                                     | Phase 3 aggregates integers and formats once                 |
| Parse amounts from the string, not `parseFloat`           | Not because floats round wrongly — for 2-decimal input they don't. Because `parseFloat` **accepts** `"12.345"` and reads `"12,34"` as 12 | Precision is a check; comma input works                      |
| `type="text" inputMode="decimal"`, never `type="number"`  | `type="number"` lets the browser's locale rules reject or reformat `"12,34"` before the schema sees it                                 | Numeric keypad on mobile without losing control of parsing   |
| Reject future dates beyond 24h                            | An expense records what happened; the 24h slack means a user ahead of the server is never told today is invalid                        | Revisit if scheduled expenses are ever wanted                |
| Fuel fields never conditional on category **in the schema** | Category names become user-editable in 02-07; branching validation on `"Fuel"` would break on a rename                                 | Only form *visibility* branches, chosen by entry point       |
| The form may name-match the **system** Fuel category      | It matches `userId: null` rows only, which no user can rename — the rename objection does not apply to them                            | Fuel entry preselects sensibly; user categories stay off-limits |
| `optionalText` duplicated rather than lifted from `car.ts` | `lib/validation/car.ts` was boundary-protected by this plan                                                                           | 02-07 adds two more schemas and should consolidate all three |

## Deviations from Plan

| Type             | Count | Impact                                       |
| ---------------- | ----- | -------------------------------------------- |
| Auto-fixed       | 3     | Two were real defects; one was my own error   |
| Scope additions  | 1     | Requested at the checkpoint, spec amended first |
| Deferred         | 4     | All recorded in ROADMAP/PROJECT               |

### Auto-fixed

**1. The e2e suite was passing on borrowed state (the significant one)**

- **Found during:** Task 5, on a re-run
- **Issue:** The first `CI=true` run showed 32/32 — but only because seeded
  categories happened to still exist locally. `npm run test:integration`
  truncates `Category`, and CI runs integration **immediately before** e2e, so
  the category select rendered empty and 14 tests failed. This would have failed
  in CI every single time.
- **Fix:** `tests/e2e/helpers/categories.ts` seeds the system categories in
  `beforeEach`, idempotently.
- **Verification:** Reproduced CI's actual order locally — integration exit 0,
  then e2e exit 0, 32 passed. Later 36 with the new tests. CI then confirmed it.
- **Lesson:** this is the same shape as 02-05's stale-server failure. A green
  local run is not evidence about CI unless the ordering matches too.

**2. `MAX_AMOUNT_CENTS / 100` in my own test violated AC-1**

- **Found during:** the AC-1 audit, not by a test
- **Fix:** routed through `formatAmountInput(MAX_AMOUNT_CENTS + 100)`.
- **Note:** the AC says the money module is the only converter. A test is not
  exempt, and the audit is what caught it.

**3. A lint fix broke the type check**

- **Found during:** Task 5, when `next build` failed after `npm test` passed
- **Issue:** `delete withoutAmount.amountCents` on a non-optional inferred
  property. **Vitest does not type-check; `next build` does.**
- **Fix:** typed the fixture as `Record<string, unknown>`, which is what a form
  actually hands to `safeParse` anyway.

### Scope addition

**AC-9 / Task 7 — separate fuel and other entry points.** Requested at the
human-verify checkpoint. Classified as a **spec** issue rather than a code one,
so the PLAN gained AC-9 and Task 7 *before* any code changed. It revises rather
than contradicts Task 2's rule: validation stays unconditional, and only field
visibility branches.

### Deferred (recorded, not built)

Raised at review, each routed to where it belongs rather than absorbed here:

| Item                                | Routed to        | Why there                                                                        |
| ----------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| Odometer capture on the expense form | **02-07**        | Needs the `OdometerReading` data layer, which is 02-07's subject. `OdometerSource.EXPENSE` already exists for exactly this |
| Litres per 100 km                    | **Phase 3**      | An aggregation over consecutive full-tank fills and odometer deltas, not a form  |
| Maintenance intervals + progress bar | **new Phase 7**  | Needs a new entity (interval in km and/or months, last done at reading/date)      |
| System categories need `db:seed`     | **02-07**        | They are global rows created by no runtime code; a fresh production DB has none   |

## My Own Verification Errors

Recorded because the pattern repeats and the countermeasure is cheap:

1. **Grep reported the actions were missing `requireUserId`.** They weren't — my
   `grep -A2` couldn't reach past multi-line function signatures. Parsing each
   function's first statement gave the right answer.
2. **The first e2e pass was not evidence.** See auto-fix 1.

Both are the 02-05 lesson recurring: verify the property, not a proxy for it.

## Next Phase Readiness

**Ready:**

- Expenses record, edit, delete, and total correctly, scoped and proven
- `lib/money.ts` is the money primitive Phase 3 aggregates on
- The relation-scoping pattern is established for any entity without a `userId`

**Concerns:**

- No accessibility audit yet; WCAG AA is a stated goal
- System categories still depend on `db:seed` having run
- `optionalText` now exists in two places

**Blockers:** None.

**Phase 2 is 6 of 7 — no transition.** The plan/summary file counts now match at
6 = 6, which the completion heuristic reads as "phase complete" for the seventh
time. `02-07` is declared in ROADMAP but has no PLAN file yet. ROADMAP is the
authority.

---

_Built with PAUL Framework v1.4 · <https://chrisai.cv/skool>_
_Phase: 02-foundations, Plan: 06_
_Completed: 2026-08-08_
