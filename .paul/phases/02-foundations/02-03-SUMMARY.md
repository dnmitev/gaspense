---
phase: 02-foundations
plan: 03
subsystem: database
tags: [prisma, prisma-7, postgres, migrations, seed, integration-tests, docker, driver-adapter]

# Dependency graph
requires:
  - phase: 02-02
    provides: The Vitest harness this plan extended with a DB-backed project
provides:
  - Prisma 7 schema for User, Car, Category, Expense, OdometerReading
  - Two committed migrations, including raw-SQL partial unique indexes
  - Idempotent default-category seed, importable by tests
  - Serverless-ready client singleton via the pg driver adapter
  - Docker Postgres for local dev + a CI service container
  - 8 DB-backed integration tests, and docs/ARCHITECTURE.md updated to match
affects: [02-04, 02-05, 02-06, 03-reporting]

# Tech tracking
tech-stack:
  added: [prisma@7, "@prisma/client@7", "@prisma/adapter-pg", dotenv, tsx]
  patterns:
    - "Read the installed major version's conventions before writing config — Prisma 7 broke three plan assumptions"
    - "Idempotency and migration correctness proven by querying Postgres, never by reading code"
    - "Unit and integration suites are separate Vitest projects so the fast loop needs no database"

key-files:
  created:
    [prisma/schema.prisma, prisma.config.ts, prisma/seed.ts, prisma/migrations/, lib/prisma.ts, lib/seed-categories.ts, docker-compose.yml, .env.example, tests/integration/helpers.ts, tests/integration/setup.ts, tests/integration/schema.test.ts, tests/integration/seed.test.ts]
  modified:
    [package.json, vitest.config.ts, eslint.config.mjs, .prettierignore, .gitignore, .github/workflows/ci.yml, docs/ARCHITECTURE.md]

key-decisions:
  - "Prisma 7 requires a driver adapter — @prisma/adapter-pg, which also answers the serverless pooling concern"
  - "Connection URLs live in prisma.config.ts; the datasource block rejects url and directUrl"
  - "Category uniqueness needs raw-SQL partial indexes because Postgres treats NULLs as distinct"
  - "Seed logic extracted to lib/seed-categories.ts so tests import it without side effects"
  - "prisma init's 71 injected agent-skill files removed after verifying they do not regenerate"
  - "Local Postgres on host port 5433 — another project already holds 5432"

patterns-established:
  - "Migration correctness is proven against a throwaway empty database, then dropped"
  - "Integration tests truncate between cases so the suite is repeatable, not fresh-DB-only"

# Metrics
duration: 35min
started: 2026-08-07T15:19:21Z
completed: 2026-08-07T17:18:49Z
description: "Prisma 7 data layer with committed migrations, partial-index-backed idempotent seed, and 8 integration tests green against Postgres in CI"
type: Summary
about: "gaspense"
---

# Phase 2 Plan 03: Data Layer Summary

**The data layer exists and is proven: five entities, two committed migrations, an idempotent seed verified by row count, and 8 integration tests running against real Postgres in CI — built on a Prisma major version that contradicted three of the plan's assumptions.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~35 min (working time; wall clock spans a gap) |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 12 |
| Files modified | 7 |
| Integration tests | 8, across 2 files |
| Escalation statuses | DONE ×3 |
| Checkpoints | None |
| CI | `success` — check, build, unit, migrate, integration, e2e |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Schema models five entities with agreed semantics | **Pass (adapted)** | 5 models, `deletedAt` on Car only, nullable `Category.userId`, NextAuth-compatible User, no deferred models. **The `directUrl` requirement was dropped — Prisma 7 rejects it outright** (see Deviations) |
| AC-2: Migration applies cleanly from an empty database | **Pass** | Created a throwaway `gaspense_empty_probe` DB: `migrate deploy` applied 2 migrations (exit 0), a second run reported "No pending migrations" (exit 0), probe dropped |
| AC-3: Category seed is idempotent | **Pass** | Two runs → inserted 10 then 0; Postgres `count(*) where "userId" is null` = 10 |
| AC-4: Unit DB-free, integration DB-backed | **Pass** | `npm test` (2 tests) passes with no database; `npm run test:integration` (8 tests) passes and is repeatable across consecutive runs |
| AC-5: CI runs integration against real Postgres | **Pass** | Service container + health check; steps `Apply migrations` and `Integration tests` both `success`. Credentials are plain workflow env values, deliberately not secrets |
| AC-6: ARCHITECTURE matches what was built | **Pass** | Five entities field-for-field, a Deferred table naming phase + reason for each of the three, both deviations stated, and the stale "decided in Phase 2" line removed |

## Verification Results

- `prisma validate` exit 0; declared-model count asserted as exactly 5
- Empty-database migration probe: 2 applied, re-run a no-op, probe database dropped
- Seed idempotency read from Postgres directly, not from the seed's own output
- Both partial indexes confirmed present via `pg_indexes`
- `npm test` green with Docker irrelevant; `npm run test:integration` green twice in a row
- `tsc --noEmit` exit 0; `npm run build` exit 0; `npm run check` exit 0
- CI step list queried via API: `Initialize containers` → … → `Apply migrations` → `Integration tests` → e2e, all `success`
- Secret/PII scan across `prisma/`, `lib/`, `tests/`, `docker-compose.yml`, `.env.example`: no key-like strings, no plate-like patterns; `.env` confirmed gitignored **before** being written

## Accomplishments

- **Three Prisma 7 breaking changes caught by reading the package instead of assuming.** Any one of
  them would have produced a broken or non-compiling data layer. Details below.
- **The NULL-distinctness trap was real and is now closed.** Two raw-SQL partial unique indexes make
  the seed genuinely idempotent; integration tests additionally prove a user's own "Fuel" can
  coexist with the system "Fuel" while a duplicate within one user is rejected.
- **Soft delete is proven, not just modelled.** A test asserts that expenses remain reachable after
  their car is soft-deleted — the entire reason the decision exists.
- **The serverless pooling concern now has a concrete lever.** `@prisma/adapter-pg` accepts a
  `pg.Pool`, so pool sizing is a config change at deploy time rather than an architectural problem.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Created | 5 models, 2 enums, indexes; extensive comments on every deliberate choice |
| `prisma.config.ts` | Created | Prisma 7 config — connection URL, migrations path, seed command |
| `prisma/migrations/**` | Created | `init` + `category_unique_partial_indexes` (raw SQL), both committed |
| `prisma/seed.ts` | Created | Thin runner; logic lives in `lib/seed-categories.ts` |
| `lib/seed-categories.ts` | Created | Importable seed logic so tests need no side effects |
| `lib/prisma.ts` | Created | Client singleton via `PrismaPg`, cached on `globalThis` outside production |
| `docker-compose.yml` | Created | Local Postgres 17 on host port **5433** |
| `.env.example` | Created | First real env file — placeholders only, with an explicit public-repo warning |
| `tests/integration/**` | Created | Helpers, dotenv setup, schema round-trip + soft delete, seed idempotency |
| `vitest.config.ts` | Modified | Split into `unit` and `integration` projects |
| `.github/workflows/ci.yml` | Modified | Postgres service + health check, `Apply migrations`, `Integration tests` |
| `eslint.config.mjs`, `.prettierignore`, `.gitignore` | Modified | Exclude the generated client from lint/format/git |
| `package.json` | Modified | `postinstall`, `db:seed`, `test:integration`; split `test` |
| `docs/ARCHITECTURE.md` | Modified | Data model replaced with as-built; Deferred table; both deviations recorded |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `@prisma/adapter-pg` driver adapter | Prisma 7 makes it mandatory — `PrismaClientOptions` is a union of Accelerate-or-adapter | Also the pooling lever for Vercel serverless |
| Money as `amountCents Int` | Decimal.js does not cross the Next server→client boundary as a number | Exact arithmetic; trivial `SUM()` for Phase 3 |
| `liters` as `Float` | Unlike money, no exact-cent arithmetic depends on it | Avoids Decimal serialisation for a value where precision loss is harmless |
| `pricePerLiter` not stored | Derived from `amountCents / liters`; a stored copy can drift | Compute at display time |
| Raw-SQL partial unique indexes | Prisma cannot express them, and `@@unique([userId, name])` is defeated by NULL distinctness | Seed idempotency works via `ON CONFLICT DO NOTHING` |
| Seed logic in `lib/`, runner in `prisma/` | Importing a script would execute it | Tests exercise the real seed logic |
| `tsx` for the seed | Generated client uses bundler-style extensionless imports | Bare `node` cannot resolve them |
| Generated client to `lib/generated/prisma` | Prisma 7's default is `app/generated/prisma` — inside the App Router tree | Avoids generated files being treated as routes or linted |
| Host port 5433 | Another project's container already binds 5432 | That container was left running, untouched |
| Remove `prisma init`'s agent-skill files | Unrequested, 424K, 71 files, and duplicative of the Phase 0 agent-context strategy | Verified non-regenerating, so removal is durable |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Plan assumptions invalidated by Prisma 7 | 3 | One AC condition became impossible |
| Unrequested vendor footprint removed | 1 | `.gitignore` edit reverted, 71 files removed |
| Environment collision worked around | 1 | Port 5433 instead of 5432 |
| Scope additions beyond `files_modified` | 5 | All necessary consequences of Prisma 7 |
| My own errors, self-corrected | 3 | Two false-positive checks, one file mix-up |

### Prisma 7 Invalidated Three Plan Assumptions

The plan was written against Prisma 5/6 conventions. All three were caught by inspecting the
installed package, exactly as the plan instructed.

1. **Connection URLs moved to `prisma.config.ts`.** The datasource block now rejects `url` *and*
   `directUrl` — `prisma validate` reports *"no longer supported in schema files"*. **AC-1's
   requirement that `directUrl` appear in the schema was therefore unsatisfiable.** The intent —
   configuring the pooled/direct split — is met via `shadowDatabaseUrl` in config plus documented
   production guidance in `.env.example`. Recorded rather than quietly dropped.
2. **A driver adapter is mandatory.** `PrismaClientOptions = PrismaClientOptionsWithAccelerateUrl |
   PrismaClientOptionsWithAdapter`, so `new PrismaClient()` does not compile. Installed
   `@prisma/adapter-pg` (which brings `pg` transitively). Silver lining: it accepts a `pg.Pool`,
   which is precisely what the recorded serverless-pooling concern needs.
3. **The generated client cannot run under bare Node.** Its internal imports are extensionless,
   targeting a bundler; Node's ESM loader fails with `ERR_MODULE_NOT_FOUND` on
   `lib/generated/prisma/enums`. Adding a `.ts` extension to my own import did not help (and tsc
   rejects it without `allowImportingTsExtensions`). Resolved with `tsx`.

### Unrequested Vendor Footprint

**`prisma init` injected 71 files (424K) and edited `.gitignore`.** It created `.agents/skills/*`,
`.claude/skills/`, `.windsurf/`, and `skills-lock.json`. The `.gitignore` edit was detected by
checksum and reverted immediately — it is a protected boundary in earlier plans.

The files were removed after **verifying they do not regenerate** (deleted them, ran
`prisma generate`, confirmed still absent). That distinction mattered: Next.js's `AGENTS.md` block
*does* regenerate and was therefore accepted in 02-01, whereas these do not, so removal is durable.
Rationale for removing: unrequested, sizeable in a public repo, `.claude/skills/` collides with this
project's own `.claude/` conventions, and they duplicate the deliberate single-source
CLAUDE.md/AGENTS.md strategy decided in Phase 0. Fully reversible via `prisma init`.

### Environment Collision

**Host port 5432 was already bound** by `inio-postgres-1`, a container from another of the user's
projects. Rather than stop it, gaspense's Postgres was moved to **5433** and `.env`,
`.env.example`, and `docker-compose.yml` updated. The other container was verified still running
afterwards.

### Scope Additions Beyond `files_modified`

All are direct consequences of Prisma 7 and were not foreseeable when the plan was written:
`prisma.config.ts` (Prisma 7's config location), `lib/seed-categories.ts` (testable seed logic),
`tests/integration/helpers.ts` + `setup.ts`, and lint/format/git ignores for the generated client
(`eslint.config.mjs`, `.prettierignore`, `.gitignore`). Extra dependencies: `@prisma/adapter-pg`,
`dotenv`, `tsx`.

### My Own Errors, Self-Corrected

1. **Two verification checks produced false positives** by matching *comments*. The schema documents
   why `pricePerLiter` and `directUrl` are absent, and my greps matched that prose. Fixed by
   stripping comments before checking, and by treating `prisma validate` as authoritative.
2. **I wrote the docker-compose content into `.env.example`.** Caught and both files rewritten
   correctly.
3. **`test:integration` initially used `dotenv -e`**, a CLI the `dotenv` package does not provide.
   Replaced with a Vitest `setupFiles` entry importing `dotenv/config`, which works locally and in
   CI without a wrapper.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `new PrismaClient()` failed to typecheck | Not a mistake in the call — Prisma 7 requires an adapter. See above. |
| Seed failed with `ERR_MODULE_NOT_FOUND` twice | First my extensionless import, then the client's *own* internal imports. Root cause was the bundler-targeted output; `tsx` resolves it. |
| `docker compose up` failed: port already allocated | Diagnosed the owner via `lsof`/`docker ps` before touching anything; moved to 5433 rather than stopping another project's database. |
| `tsc exit: 0` reported while errors printed | The pipe trap again — read through `tail`. Re-measured directly: exit 1. **Third occurrence; the habit needs to stick.** |

## Next Phase Readiness

**Ready:**
- Schema, migrations, and seed in place; `User` is NextAuth-adapter-shaped so **02-04 needs no
  `User` migration** — only the Account/Session/VerificationToken tables the adapter defines
- Integration harness with truncation between tests, which is exactly what 02-04's per-user
  isolation tests need
- CI applies migrations before tests, so schema changes are exercised on every push

**Concerns:**
- **Isolation still has no database backstop.** NextAuth means app-layer scoping only, no RLS. Every
  query path in 02-04/02-05/02-06 needs a test proving one user cannot read another's rows — the
  harness now exists, so there is no excuse for skipping it.
- **`amountCents` requires discipline at every boundary.** Any UI or report must divide by 100 for
  display and multiply on input. A single missed conversion is a 100× error in someone's fuel costs.
- **Production database is entirely unwired.** No Supabase project, and Prisma 7 removed the
  `directUrl` mechanism the original design assumed. Deployment will need a fresh decision about
  pooled-vs-direct connections and the pg Pool configuration.
- **CI now runs two builds and a database.** Runtime is growing; worth watching.
- **`prisma init` should never be re-run** in this repo — it would re-inject the 71 skill files and
  re-edit `.gitignore`.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 02-foundations, Plan: 03*
*Completed: 2026-08-07*
