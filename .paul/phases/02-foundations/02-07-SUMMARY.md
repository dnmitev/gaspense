---
phase: 02-foundations
plan: 07
subsystem: database
tags: [prisma, migration, zod, nextjs, server-actions, playwright, vitest]

requires:
  - phase: 02-foundations (02-06)
    provides: the expense vertical slice, relation-scoping pattern, e2e category seeding helper
provides:
  - Category CRUD restricted to user-owned rows
  - Odometer log per car
  - Odometer capture on fuel entry, linked to its expense
  - OdometerReading.expenseId (nullable, unique, cascade)
affects: [phase-3-reporting, phase-7-maintenance, phase-8-test-environment-safety]

tech-stack:
  added: []
  patterns:
    - "Database constraints Prisma cannot type are returned as described results, not thrown"
    - "System rows stay immutable through ordinary scoping, with no special case"
    - "Cross-entity invariants maintained inside prisma.$transaction"

key-files:
  created:
    - prisma/migrations/20260808062100_link_odometer_to_expense/
    - lib/categories.ts
    - lib/odometer.ts
    - lib/validation/category.ts
    - lib/validation/odometer.ts
    - app/categories/**
    - app/cars/[id]/odometer/**
  modified:
    - prisma/schema.prisma
    - lib/expenses.ts
    - lib/validation/expense.ts
    - lib/validation/shared.ts
    - docs/ARCHITECTURE.md

key-decisions:
  - "OdometerReading gains a nullable unique expenseId with ON DELETE CASCADE"
  - "Category deletion is refused with a count, never a silent reassignment"
  - "System categories are protected by ordinary scoping, not a special case"
  - "Odometer readings are NOT required to increase"
  - "The recorded-date rule is shared between expense and odometer schemas"

patterns-established:
  - "P2002/P2003 are ordinary outcomes to describe, not exceptions to leak"
  - "Migrations are generated with `prisma migrate diff` and proven with `migrate deploy`"

duration: 195min
started: 2026-08-08T06:16:39Z
completed: 2026-08-08T09:31:38Z
description: "Category CRUD over user-owned rows, an odometer log, and odometer capture on fuel entry linked to its expense"
type: Summary
about: "gaspense"
---

# Phase 2 Plan 07: Categories, Odometer, and Odometer-on-Fill-up — Summary

**The last plan of Phase 2. A user now manages their own categories, keeps an
odometer log, and records mileage at the moment of a fill-up — with the reading
tied to the expense that produced it.**

## Performance

| Metric    | Value                                             |
| --------- | ------------------------------------------------- |
| Duration  | ~3h 15m (plan created → loop closed)              |
| Started   | 2026-08-08T06:16:39Z                              |
| Completed | 2026-08-08T09:31:38Z                              |
| Tasks     | 6 completed (5 auto + checkpoint approved)        |
| Tests     | 227 total (85 unit, 89 integration, 53 e2e)       |
| CI        | success on `b9081c8`                              |

## Acceptance Criteria Results

| Criterion                                        | Status | Evidence                                                                                          |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| AC-1: A user manages their own categories        | Pass   | Add/rename/delete through the UI and data layer; system defaults remain available throughout       |
| AC-2: System categories readable, never writable | Pass   | Rename and delete of a `userId: null` row affect zero rows; re-read confirms it unchanged for others |
| AC-3: A category in use cannot be destroyed      | Pass   | Refused with the expense count; category and expenses both survive                                 |
| AC-4: Duplicate names are a field error          | Pass   | P2002 caught and rendered on the name field; a different user may still use the name               |
| AC-5: Cross-user isolation                       | Pass   | Every leakage test re-reads the victim's row and asserts it unmodified                             |
| AC-6: A car has an odometer log                  | Pass   | Scoped list/create/update/delete, all refused across users                                          |
| AC-7: A fill-up captures the odometer            | Pass   | One `EXPENSE`-sourced reading linked to the expense; blank creates nothing                          |
| AC-8: Expense and reading stay consistent        | Pass   | Update, clear, and delete each verified — including the cascade, asserted rather than assumed       |
| AC-9: Full gate green                            | Pass   | check 0 · build 0 · unit 0 · integration 0 · e2e 0; migration applies to an empty database          |

## What Was Built

The migration is the piece with the longest reach. `OdometerReading.expenseId`
is nullable, unique, `ON DELETE CASCADE` — the first schema change since 02-03.
`source: EXPENSE` recorded only that a reading came from *some* fill-up, which
cannot maintain the pair: matching on `(carId, date)` is ambiguous because two
fill-ups in a day are ordinary, and editing an expense's date orphans its
reading. The cascade is what stops a stale reading outliving the fill-up it
claims to measure, which would silently corrupt the consumption series Phase 3
computes.

Roughly 1,800 lines across `lib/categories.ts`, `lib/odometer.ts`, two
validation schemas, `app/categories/**`, `app/cars/[id]/odometer/**`, and four
test suites.

## Decisions Made

| Decision                                              | Rationale                                                                                                                    | Impact                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| P2002 and P2003 are described results, not exceptions | Adding a duplicate name and deleting a category you forgot you used are ordinary actions, not error conditions                | Any future raw-SQL constraint needs the same treatment     |
| Category deletion refused with a count                | Silently reassigning someone's records while they asked to delete a label is a bigger action than the one they requested      | A bulk re-categorise is a feature, if it is ever wanted    |
| System rows protected by ordinary scoping             | `where: { id, userId }` cannot match a NULL `userId`. A special case would imply the general rule needs supervision           | The integration suite is what proves the rule suffices     |
| Odometer readings need not increase                   | Odometers are replaced, corrected, and roll over; a hard rule blocks legitimate entry with no way around it                   | **Phase 3 must cope with an out-of-order series**          |
| `recordedDate` shared between schemas                 | Two schemas quietly disagreeing about what a valid date is would be worse than either rule alone                              | 02-07 also removed the duplicated copy from `expense.ts`   |
| `source` is not updatable                             | A reading from a fill-up must keep saying so, or the log becomes unexplainable to whoever reads it                            | Enforced by omission from the update payload, and tested   |

## Deviations from Plan

| Type            | Count | Impact                                        |
| --------------- | ----- | --------------------------------------------- |
| Auto-fixed      | 5     | Four were my own errors, one a tooling refusal |
| Scope additions | 0     | —                                              |
| Deferred        | 2     | Recorded below                                |

### Auto-fixed

**1. `prisma migrate dev` cannot run headless — and `migrate reset` is blocked**

The plan said to generate the migration with `migrate dev`. It refuses in a
non-interactive environment (it wants confirmation about the new unique
constraint), and Prisma 7 additionally **refuses `migrate reset` when it detects
Claude Code** — a deliberate guard against destructive AI actions, and a good
one. Generated with `prisma migrate diff --from-config-datasource --to-schema`
instead, which is still Prisma writing the SQL from the schema, then proved it
on a throwaway database with `migrate deploy` — CI's actual command. Verified in
the Postgres catalog afterwards: nullable column, unique index,
`delete_rule=CASCADE`.

**2. A silent no-op replace put nothing in the form (the instructive one)**

The odometer field never reached `expense-form.tsx`: a string replace missed
because indentation had shifted when `FuelDetails` was introduced. **The build
passed.** It was caught only when an e2e test could not find the label. Grepping
for `id="odometer"` — the thing itself — is what confirmed the fix.

**3. e2e interacted with a page before navigation completed**

Clicked "Rename", then filled the field immediately. `/categories` also has a
"Category name" input, so the fill landed on the page about to be replaced. The
expense suite avoided this by asserting a heading after each click; this one
skipped it.

**4. A page-wide text assertion matched a seeded category**

"Maintenance" is one of the ten defaults, so the assertion matched both the
user's row and the built-in chip. Fixed by giving the two lists `aria-label`s
and scoping the assertions — better for screen readers as well.

**5. A CI-only race in the duplicate-name test**

The test submitted the add-category form twice in a row. The action redirects,
so on CI — slow enough for the gap to be observable — the second submit raced
the first navigation. **Locally it passed; CI failed on `e95e245`.** Fixed with
an explicit barrier and verified with `--repeat-each=3`; green on `b9081c8`.

This is the third time in three plans that a green local e2e run has not been
evidence about CI. The others were a stale reused server (02-05) and leftover
seed data (02-06). Different causes, same lesson.

### Deferred

| Item                                     | Routed to   | Note                                                                    |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| System categories require `db:seed`      | Phase 3+    | Still true: they are global rows created by no runtime code             |
| Interpolating odometer gaps for L/100 km | Phase 3     | Carried forward from the plan, unchanged                                |

## Process Issue Worth Recording

**Commit `e95e245` contains changes I did not author.** ROADMAP.md and STATE.md
were edited by another session while this plan was executing, and `git add -A`
swept those edits into my apply commit. The content is legitimate and valuable —
it is the Phase 8 proposal below — but it was committed without review as part
of an unrelated change. `git add -A` is not safe when another process may be
writing to the working tree.

**Phase 8: Test Environment Safety** was added that way, and its central claim
was verified here rather than taken on trust: `resetDatabase()` in
`tests/integration/helpers.ts` issues `TRUNCATE ... CASCADE` with **no assertion
about which database it is connected to**, and `playwright.config.ts` passes the
same `DATABASE_URL` through, so development, integration, and e2e all share
`gaspense_dev`. Running the integration suite already destroys local development
data. The concern is real and correctly described.

## Next Phase Readiness

**Ready:**

- Phase 2's goal is met: a user can log in, add a car, and record expenses
  against categories they control
- The odometer series exists and is linked to fill-ups — the prerequisite for
  Phase 3's litres-per-100 km and Phase 7's service intervals
- Every entity has a scoped data layer with cross-user leakage tests

**Concerns:**

- **The integration suite truncates whatever `DATABASE_URL` points at** — the
  subject of the newly-added Phase 8, and the sharpest edge in the repo
- No accessibility audit yet; WCAG AA is a stated goal
- System categories depend on `db:seed` having run

**Blockers:** None.

**Phase 2 is complete — 7 of 7.** The transition is executed alongside this
summary.

---

_Built with PAUL Framework v1.4 · <https://chrisai.cv/skool>_
_Phase: 02-foundations, Plan: 07_
_Completed: 2026-08-08_
