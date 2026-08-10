---
phase: 08-test-environment-safety
plan: 01
subsystem: testing
tags: [postgres, prisma, vitest, playwright, pg, test-isolation]

requires:
  - phase: 02-foundations
    provides: the integration suite, resetDatabase(), and the e2e helpers that write directly to the database
provides:
  - a dedicated gaspense_test database, separate from gaspense_dev
  - resolveTestDatabaseUrl() — one resolver shared by Vitest and Playwright
  - npm run db:test:setup — idempotent create + migrate
  - proof via current_database() that the suite connects where it believes it does
affects: [08-02-guard, 04-pwa-mobile-ux, all future phases that run the suites]

tech-stack:
  added: [pg, "@types/pg"]
  patterns:
    - "Test infrastructure resolves its own database URL and overwrites DATABASE_URL for the run"
    - "Assert connection reality (current_database()), not configuration intent"

key-files:
  created:
    - tests/test-database.ts
    - tests/unit/test-database.test.ts
    - tests/integration/database.test.ts
    - scripts/setup-test-db.ts
  modified:
    - tests/integration/setup.ts
    - playwright.config.ts
    - package.json
    - .env.example
    - CLAUDE.md
    - AGENTS.md

key-decisions:
  - "TEST_DATABASE_URL wins over DATABASE_URL; falling back to DATABASE_URL keeps CI unchanged"
  - "Overwrite process.env.DATABASE_URL rather than thread a second variable through helpers"
  - "e2e shares the test database with integration; no third database"
  - "reuseExistingServer: false — a reused dev server would test the wrong database and pass"

patterns-established:
  - "Prove the connection with current_database(); reading the env var back only proves setup ran"
  - "A guard's control must fail in both directions before either direction is believed"

duration: 36min
started: 2026-08-10T10:15:04Z
completed: 2026-08-10T10:41:07Z
description: "Tests run against a dedicated gaspense_test database; the development database survives a full suite run, proven against real demo data"
type: Summary
about: "gaspense"
---

# Phase 8 Plan 01: A Dedicated Test Database — Summary

**The suites now truncate `gaspense_test` and nothing else. The demo dataset in `gaspense_dev`
survived a full integration run plus 88 e2e tests byte-for-byte — the accident that cost two
re-logins in one session can no longer happen.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~36 min (PLAN → UNIFY) |
| Started | 2026-08-10T10:15:04Z |
| Completed | 2026-08-10T10:41:07Z |
| Tasks | 3 of 3 complete, all PASS |
| Files created | 4 |
| Files modified | 6 (+ `.env`, untracked) |
| Tests added | 11 (9 unit, 2 integration) |

## Acceptance Criteria Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC-1: Integration suite runs against a non-development database | **Pass** | `tests/integration/database.test.ts` asserts `current_database()` equals the resolver's name and is not `gaspense_dev` |
| AC-2: Development data survives a full integration run | **Pass** | `gaspense_dev` held 1 user / 1 car / 47 expenses / 10 categories / 30 readings before, and **identical counts** after integration + 88 e2e tests |
| AC-3: An ambient production `DATABASE_URL` cannot reach the suite | **Pass** | With `DATABASE_URL` exported at an unreachable host the suite passes (14 tests); with the *preferred* variable pointed there it fails naming `db.unreachable-host.invalid` |
| AC-4: Test database creatable from nothing with one command | **Pass** | `dropdb` → `db:test:setup` created + migrated 4 migrations; second run reported "already exists" / "No pending migrations", exit 0 both times |
| AC-5: e2e exercises the test database, never development | **Pass** | 88 e2e tests green under `CI=true`, after the deviation below was fixed |
| AC-6: CI needs no workflow change | **Pass (local)** | `.github/workflows/ci.yml` untouched (`git diff` empty); the fallback it relies on is unit-tested. **Real confirmation lands on the next push** |

## Verification Results

| Gate | Exit | Result |
|------|------|--------|
| `npm run check` | 0 | format, lint, markdownlint, docs presence |
| `npm run build` | 0 | TypeScript clean (Vitest does not type-check) |
| `npm test` | 0 | **176** unit (was 167) |
| `npm run test:integration` | 0 | **131** (was 129) |
| `CI=true npm run test:e2e` | 0 | **88** |

Total: **395 tests** (was 384). Every exit code read directly, never through a pipe.

## Accomplishments

- **The phase goal demonstrated on real data, not a synthetic marker.** `gaspense_dev` still held
  the demo dataset, so AC-2 was proven against the genuine fixture rather than a stand-in.
- **`current_database()` as the assertion.** Reading `process.env.DATABASE_URL` back would only
  prove `setup.ts` ran — not that Vitest's setupFiles ordering actually beats the module-scope
  `createTestClient()` calls in every other spec. That ordering is the assumption the whole plan
  rests on, and it is now covered by a test rather than by reasoning.
- **A control that fails in both directions.** The first AC-3 control was invalid: `env -u
  TEST_DATABASE_URL` did nothing, because dotenv simply reloaded the variable from `.env`.
  Inverting the URLs produced a real failure naming the unreachable host, which is what makes the
  passing direction meaningful.
- **`npm run db:test:setup` is idempotent**, so a fresh clone and an existing volume are handled
  by the same command.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `tests/test-database.ts` | Created | `resolveTestDatabaseUrl()` + `databaseNameFromUrl()`, shared by Vitest and Playwright |
| `tests/unit/test-database.test.ts` | Created | 9 DB-free tests over the resolution order and URL parsing |
| `tests/integration/database.test.ts` | Created | Proves the live connection via `current_database()` |
| `scripts/setup-test-db.ts` | Created | Idempotent create + `migrate deploy` |
| `tests/integration/setup.ts` | Modified | Overwrites `process.env.DATABASE_URL` with the resolved test URL |
| `playwright.config.ts` | Modified | Resolved URL for the server **and** the worker processes; `reuseExistingServer: false` |
| `package.json` | Modified | `db:test:setup` script; `pg` + `@types/pg` as devDependencies |
| `.env.example` | Modified | `TEST_DATABASE_URL` documented; production notes now name the hazard |
| `CLAUDE.md` / `AGENTS.md` | Modified | Test-database section; stale truncation warning replaced; `reuseExistingServer` note |
| `.env` | Modified (untracked) | One appended line; gitignored via `.gitignore:12` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `TEST_DATABASE_URL` preferred, `DATABASE_URL` as fallback | The fallback is what lets CI pass unedited; 08-02's guard is what makes the fallback safe | 08-02 must refuse a non-test target, or the fallback becomes the hole |
| Overwrite `process.env.DATABASE_URL` rather than thread a second variable | Four call sites build their own clients from it; a future spec inherits the safety instead of remembering a helper | Any new test client is covered automatically |
| No opt-in `ALLOW_DESTRUCTIVE_TESTS` flag | Set once in `.env` and forgotten, it stays true when the shell later points at production — it decouples the permission from the target | 08-02's guard derives safety from the URL itself |
| e2e shares the test database with integration | e2e never truncates; it creates randomly-named users and deletes them. A third database buys no isolation | `ensureSystemCategories()` reasoning stays valid unchanged |
| `db:test:setup` over a `docker-entrypoint-initdb.d` script | Init scripts run only against a fresh volume — it would do nothing while reading like it worked, and forcing it means `docker compose down -v` | One command covers fresh clone and existing volume |
| `reuseExistingServer: false` | `npm run dev` serves `gaspense_dev` while helpers write `gaspense_test`; reuse would test the wrong database and pass | Local e2e now needs port 3000 free, and fails loudly if not |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Spec gap (plan was wrong) | 1 | Essential — caught by a failing suite, fixed |
| Auto-fixed | 2 | Routine |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** one genuine plan-level omission, found and closed by verification rather than by
review. No scope creep.

### Spec gap — the plan under-specified the e2e wiring

- **Found during:** Task 2 verification (first full e2e run)
- **Issue:** the plan's Task 2 said to replace `webServer.env.DATABASE_URL`. That covers the server
  under test and silently abandons the **helpers**: `tests/e2e/helpers/auth.ts` and
  `categories.ts` build their own Prisma clients from `process.env.DATABASE_URL` and run in
  Playwright's *worker* processes, not in the server. The helper wrote its `Session` row to
  `gaspense_dev`, the server looked it up in `gaspense_test`, found nothing, redirected to
  `/signin` — and all 88 tests timed out waiting for content that would never render.
- **Fix:** also assign `process.env.DATABASE_URL = TEST_DATABASE_URL` at config module scope.
- **Verified:** the assumption that Playwright loads the config in each worker was tested with a
  single spec (9 passed) before the full suite was trusted; then 88 passed.
- **Note:** this failure mode is loud and total rather than silent — a future regression breaks
  every e2e test instead of quietly testing the wrong data. That is a tolerable residual coupling.

### Auto-fixed

1. **Invalid negative control for AC-3.** `env -u TEST_DATABASE_URL` proved nothing, because
   `dotenv/config` reloaded the variable from `.env` the moment the shell stopped setting it.
   Replaced with an inverted-URL control that genuinely fails.
2. **Prettier reformatting.** Four files needed `npm run format` after authoring; folded in
   before the gate was re-run.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| First full e2e run failed 88/88 with timeouts | Diagnosed as a database split-brain between helpers and server; fixed at the config module (see spec gap above) |
| Phase directory would read as "complete" | 1 PLAN + 1 SUMMARY matches the file-count heuristic, but ROADMAP is the authority and lists 2 plans. Transition deliberately **not** triggered — the same false signal this project correctly ignored twice in Phase 3 |

## Next Phase Readiness

**Ready:**

- `gaspense_test` exists, is migrated, and is reproducible with one command
- `resolveTestDatabaseUrl()` is the single place that answers "which database do the tests own",
  imported by both Vitest and Playwright
- 08-02 can now add the guard without leaving the suite unrunnable — the target is already a
  test-shaped database, so a host-and-name refusal will pass on the first run

**Concerns:**

- **AC-6 is proven locally but not yet in CI.** `ci.yml` was deliberately not edited; the next
  push is what confirms the fallback works in the real workflow.
- **`resetDatabase()` still truncates without asking what it is aimed at.** This plan moved the
  target; nothing yet stops it firing at the wrong one. That is 08-02, and it is the reason this
  phase is not finished.
- **The e2e helpers depend on Playwright loading the config per worker.** Empirically true for
  Playwright 1.62 and documented in a comment; a version change would break every e2e test loudly.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool*
*Phase: 08-test-environment-safety, Plan: 01*
*Completed: 2026-08-10*
