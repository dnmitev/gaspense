---
phase: 08-test-environment-safety
plan: 02
subsystem: testing
tags: [postgres, prisma, vitest, test-isolation, guard, mutation-testing]

requires:
  - phase: 08-test-environment-safety
    provides: "08-01's resolver, the gaspense_test database, and DATABASE_URL override"
provides:
  - assertTestDatabase() — a host-and-name precondition over any connection URL
  - resetDatabase() refuses a target it does not own, plus a current_database() cross-check
  - createTestClient() refuses to build against a non-test database
  - tests that watch the refusal fire, at targets a broken guard could not damage
affects: [04-pwa-mobile-ux, any future phase adding a destructive test path]

tech-stack:
  added: []
  patterns:
    - "Destructive test paths are gated by a precondition derived from the connection string"
    - "Mutation-test each half of a multi-part guard to prove both are load-bearing"
    - "Aim a refusal test somewhere a broken guard cannot damage"

key-files:
  created:
    - tests/integration/guard.test.ts
  modified:
    - tests/test-database.ts
    - tests/unit/test-database.test.ts
    - tests/integration/helpers.ts
    - CLAUDE.md
    - AGENTS.md
    - .env.example

key-decisions:
  - "Host AND name, both required — a real database can satisfy one by accident"
  - "No override flag, by standing decision from 08-01"
  - "Guard createTestClient too: truncation-only guarding stops loss but permits pollution"
  - "Refusal tests aim at the postgres maintenance database, never at gaspense_dev"

patterns-established:
  - "A guard nobody has watched fail is a comment that compiles"
  - "Mutation-test the guard, not just the happy path"

duration: 14min
started: 2026-08-10T12:03:05Z
completed: 2026-08-10T12:17:19Z
description: "Destructive test paths refuse any database that is not local and _test-named, proven by watching the refusal fire and by mutation-testing both halves"
type: Summary
about: "gaspense"
---

# Phase 8 Plan 02: The Guard — Summary

**`resetDatabase()` and `createTestClient()` now refuse any database that is not both local and
`_test`-named. Run the old misconfiguration deliberately and the suite refuses by name, leaving
`gaspense_dev` byte-identical — not one row written, not one truncated.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~14 min (PLAN → UNIFY) |
| Started | 2026-08-10T12:03:05Z |
| Completed | 2026-08-10T12:17:19Z |
| Tasks | 3 of 3 complete, all PASS |
| Files created | 1 |
| Files modified | 6 |
| Tests added | 16 (11 unit, 5 integration) |

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: Refuses a production-shaped URL | **Pass** | Unit test on a Supabase-shaped URL; integration test asserts the *guard's* message rather than `ENOTFOUND`, proving refusal precedes any connection |
| AC-2: Refuses the development database | **Pass** | Unit test on `gaspense_dev`, and the full command-line scenario below |
| AC-3: Accepts both real test databases | **Pass** | CI's connection string pinned verbatim from `ci.yml`; 136 integration tests run unchanged |
| AC-4: The refusal fires at the truncate site | **Pass** | `tests/integration/guard.test.ts`; mutation-testing confirms removing the precondition kills exactly 2 of its cases |
| AC-5: A mismatched connection is refused | **Pass** | Client attached to `postgres` while `DATABASE_URL` names the test database → refused. Mutation-testing confirms removing the cross-check kills exactly this case |
| AC-6: CI needs no workflow change | **Pass** | `git diff --stat .github/workflows/ci.yml` empty; its exact URL is unit-tested. Confirmed on CI run 31387666897 — green with the guard active and the workflow unmodified |

## Verification Results

| Gate | Exit | Result |
|------|------|--------|
| `npm run check` | 0 | format, lint, markdownlint, docs presence |
| `npm run build` | 0 | TypeScript clean |
| `npm test` | 0 | **187** unit (was 176) |
| `npm run test:integration` | 0 | **136** (was 131) |
| `CI=true npm run test:e2e` | 0 | **88**, unaffected |

Total: **411 tests** (was 395). Exit codes read directly, never through a pipe.

**The scenario that started this phase, run deliberately:**

```
TEST_DATABASE_URL="" DATABASE_URL=…/gaspense_dev npm run test:integration
→ exit 1: Refusing a destructive operation: database "gaspense_dev" is not a test database
gaspense_dev before: 1 user, 1 car, 47 expenses, 30 readings
gaspense_dev after:  1 user, 1 car, 47 expenses, 30 readings
```

## Accomplishments

- **The guard was mutation-tested, not merely covered.** Removing `assertTestDatabase` kills 2 of
  the 4 guard cases; neutering the `current_database()` cross-check kills 1. Each half is
  independently load-bearing — this project's standing rule is that you measure which check does
  the work rather than assuming.
- **Every refusal test is aimed somewhere harmless.** The production case uses an unreachable
  host; the local cases use the `postgres` maintenance database, which holds none of the
  application's tables. The obvious test — point it at `gaspense_dev` — is the one that must never
  be written, because a regressed guard would destroy exactly what the phase protects.
- **The positive control earns its place.** A guard that refused everything would pass all three
  refusal cases; the fourth case truncates the real test database and asserts it emptied.
- **CI's connection string is pinned verbatim in a unit test**, so editing the workflow without
  re-checking the guard breaks a test rather than breaking CI.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `tests/test-database.ts` | Modified | `assertTestDatabase()` + exported rule constants |
| `tests/unit/test-database.test.ts` | Modified | 11 DB-free cases, incl. CI's URL and IPv6 loopback |
| `tests/integration/helpers.ts` | Modified | Guard at both `resetDatabase` and `createTestClient`, plus the connection cross-check |
| `tests/integration/guard.test.ts` | Created | Watches the refusal fire, safely |
| `CLAUDE.md` / `AGENTS.md` | Modified | The rule, the fix, and why there is no override |
| `.env.example` | Modified | The Supabase note now describes a guarantee, not a convention |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Host **and** name, both required | A real database can satisfy one by accident; production fails both | A legitimate *remote* test database would be refused — deliberate, and the safe direction |
| Guard `createTestClient()` as well as `resetDatabase()` | Found by running the misconfiguration: truncation-only guarding stops the loss and permits the pollution | Failure moves to module scope, so a spec cannot load against the wrong database |
| Cross-check `current_database()` against the approved URL | The precondition guards a string; TRUNCATE hits a connection | Any future client builder inherits the check at the destructive site |
| Refusal tests aim at `postgres`, never `gaspense_dev` | A regressed guard must not be able to destroy the protected data | Assert on the guard's message to tell refusal apart from "relation does not exist" |
| No override flag | Standing decision from 08-01 | Permission stays attached to the target |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope additions | 1 | Essential — closed a hole the plan's own verification exposed |
| Auto-fixed | 1 | Routine |
| Deferred | 0 | — |

### Scope addition — guarding `createTestClient()`

- **Found during:** Task 3 verification, running the misconfiguration deliberately.
- **Issue:** the truncate was correctly refused, but `gaspense_dev`'s `User` count went 1 → 2. The
  positive-control test had created a row there, because `createTestClient()` built a client from
  the misconfigured URL without objection. The plan guarded only the destructive call, so it
  stopped the data loss and permitted the pollution.
- **Fix:** `assertTestDatabase` in `createTestClient()` too, plus a fifth guard test.
- **Verified:** the stray row was removed, and the re-run left `gaspense_dev` at 1/1/47/30 with
  zero writes.
- **Judgement:** taken as in scope because it serves the phase goal directly and the plan's own
  verification surfaced it. Flagged to the user as an addition rather than folded in silently.

### Auto-fixed

1. **Stale doc line.** `CLAUDE.md`/`AGENTS.md` still said that leaving `TEST_DATABASE_URL` unset
   "means the suites truncate your development database" — false once the guard exists. Same class
   of staleness 08-01 fixed; corrected in both files.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Dev database polluted during verification | Identified the exact row by email pattern, deleted it, confirmed the 1/1/47/30 baseline, then closed the hole that allowed it |

## Next Phase Readiness

**Ready:**

- Phase 8's goal is met end to end: the integration suite can destroy neither the development
  database nor a real one, and both claims are demonstrated rather than argued
- Phase 4 (PWA & Mobile UX) can proceed — it means far more time in the running app, which is why
  this phase was pulled forward

**Concerns:**

- **A legitimately remote test database would be refused.** Deliberate: the safe direction. If CI
  ever moves off a localhost service container, the rule needs revisiting — and CI's URL is pinned
  in a unit test, so that change breaks a test rather than silently disabling the guard.
- **The e2e helpers are not guarded**, by scope decision. They never truncate and delete only rows
  they created; a misconfigured e2e run would write scoped, self-cleaning rows to the wrong
  database rather than destroy anything.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool*
*Phase: 08-test-environment-safety, Plan: 02*
*Completed: 2026-08-10*
