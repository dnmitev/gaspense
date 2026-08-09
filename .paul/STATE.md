---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-07)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release — Phase 2 complete; Phase 3 (Reporting) ready to plan

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: **Phase 9 complete** → resuming Phase 3 (Reporting) at 03-02
Plan: Not started
Status: Ready to plan 03-02
Last activity: 2026-08-09 — **Phase 9 closed** in ~20 min; 304 tests green (125 unit, 109 integration, 70 e2e)

Progress:
- Milestone: [████░░░░░░] 40% (4 of 10 phases complete)
- Phase 2: [██████████] 100% (7 of 7 plans) ✅
- Phase 9: [██████████] 100% (1 of 1 plan) ✅
- Phase 3: [███░░░░░░░] 33% (1 of 3 plans) — resumes at 03-02

**Next is Phase 3, not Phase 10.** Phase 9 was numbered last for stability and pulled forward in
execution order; numbering and running order are deliberately not the same thing here.

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — Phase 9 closed, ready for PLAN 03-02]
```

## Performance Metrics

12 plans complete, ~8.2h total, ~41 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 7/7 ✅ | ~57 min |
| 03-reporting | 1/3 | ~21 min |
| 09-demo-data-seed | 1/1 ✅ | ~20 min |

**Trend:** 13, 9, 29, 33, 14, 35, 45, 28, 47, 195, **21**, **20** min. 02-07's 195 was three
vertical slices plus a migration in one plan. The two since — one concern each — came in at 21
and 20 while adding 36 and 40 tests respectively. Two data points, same result: a single-concern
plan lands in roughly 20 minutes and tests *more*, not less. Keep splitting.

## Accumulated Context

### Decisions

Only what constrains upcoming work. **Full log (28 entries): `.paul/PROJECT.md` -> Key Decisions.**

| Decision | Impact on what comes next |
|----------|---------------------------|
| Isolation is app-layer, not RLS | **02-04/05/06: every query path needs a test proving one user cannot read another's rows.** No database backstop exists |
| Money is `amountCents Int` | Every UI and report must divide by 100 to display, multiply on input. One missed conversion is a 100x error |
| Soft-delete cars only (`deletedAt`) | Every car query must filter `deletedAt: null`; expenses/odometer hard-delete |
| Schema is 5 entities | Phase 4 adds Attachment; Phase 5 adds Fine/Vignette after the research spike |
| Prisma 7: adapter mandatory, URLs in `prisma.config.ts` | Never `new PrismaClient()` bare; never put `url`/`directUrl` in the schema |
| Prisma scripts run under `tsx` | The generated client's imports are bundler-style and extensionless |
| Unit tests DB-free; integration separate | `npm test` must keep passing with Docker stopped |
| CLAUDE.md and AGENTS.md always change together | One set of facts in two files |
| Direct commits to `main`; push after every loop | No branch protection -- the pre-push hook is the only pre-landing gate |
| Public repo -- nothing sensitive, ever | `.env.example` placeholders only; no real plates or personal data in seeds/fixtures |
| NextAuth **v5 beta** + `@auth/prisma-adapter`, database sessions | v5 is beta but is the App Router API; sessions live in Postgres so Phase 6 gets the Google refresh token free |
| Google OAuth credentials are the user's to create | Automated tests create sessions directly in the DB; a real login is a manual check the user performs |
| **`lib/session.ts` is the only way to learn the caller** | `requireUserId()` throws rather than returning falsy — Prisma reads `undefined` in `where` as "no filter", so a nullable helper would leak every user's rows |
| **Mutations are server actions, not REST routes** | Reads in server components, writes in actions over a scoped data layer. `docs/ARCHITECTURE.md`'s REST table was a design sketch and gets corrected in 02-05 |
| **Hand-rolled Tailwind, no component library** | Ideation's "Tailwind + shadcn" predates any UI; adopt shadcn only when a dialog/date-picker genuinely needs it |
| **Data-layer functions take `userId` explicitly** | They never read the session themselves — keeps them unit-testable and makes a missing filter visible at the call site |
| **Writes use scoped `updateMany`, never findUnique-then-update** | Putting `userId` in the same WHERE clause as the id means a wrong owner affects zero rows; find-then-update is where cross-user writes leak |
| **`AUTH_URL` is required for a production build** | Auth.js rejects every session read with UntrustedHost otherwise. Dev mode trusts localhost, so this only appears against `next start` |
| **Verify e2e with `CI=true`** | `reuseExistingServer` can silently reuse a stale dev server, so a plain local pass proves nothing about CI |
| **Assert against comment-stripped source** | Four checks in 02-05 matched explanatory comments, not code. Counting occurrences is weaker than checking each function |
| **Vertical-slice pattern is set** | validation -> scoped data layer -> server actions -> server-component UI -> isolation tests -> authenticated e2e. 02-06 copies it |
| **`Expense` has no `userId` column** | It is scoped only via `Expense.carId -> Car.userId`. Relation filters DO work in `updateMany`/`deleteMany` (verified in the generated Prisma 7.9.1 types), but `create` has no WHERE — ownership there must be an explicit pre-check |
| **`Category.userId` is nullable — system rows are shared** | Reads use `OR: [{ userId }, { userId: null }]`. Making them writable would edit every user's category, which is why 02-07 owns that separately |
| **`lib/money.ts` is the only euro↔cent converter** | Sum integers, format once. Applies to tests too — the AC is enforced by a comment-stripped source audit, not by convention |
| **Vitest does not type-check; `next build` does** | A change can pass `npm test` and still break the build. Run both before believing a task is done |
| **e2e suites must seed their own global fixtures** | `npm run test:integration` truncates `Category`, and CI runs integration immediately before e2e — a suite relying on leftover seed data passes locally and fails in CI |
| **Migrations must be generated non-interactively** | `prisma migrate dev` refuses headless, and Prisma 7 blocks `migrate reset` when it detects Claude Code. Use `prisma migrate diff --from-config-datasource --to-schema`, then prove it with `migrate deploy` against an empty database |
| **A silent no-op replace passes the build** | The odometer field never reached the form because a string replace missed on shifted indentation. Grep for the thing itself, not just a green build |
| **Category uniqueness raises P2002, uncatchable by types** | The partial unique indexes are raw SQL, so Prisma cannot type them. Adding a duplicate name is an ordinary user action and must not 500 |
| **`Expense.category` is `onDelete: Restrict`** | Deleting a category in use raises P2003. 02-07 refuses the delete with a count rather than reassigning silently |
| **Nothing links an Expense to its OdometerReading** | `source: EXPENSE` records only that a reading came from *some* fill-up. 02-07 adds a nullable unique `expenseId` with cascade — the first schema change since 02-03 |
| **Added Phase 8: Test Environment Safety** | Extends milestone scope to 9 phases. `resetDatabase()` truncates whatever `DATABASE_URL` points at, with no guard; dev, integration, and e2e share one database. Depends only on Phase 2 — pull it before the first deployment |
| **Report isolation rests on the `getCarById` pre-check, not the relation filter** | Proven by mutation in 03-01: dropping the pre-check fails 3 tests, dropping `car: ownedCar(userId)` fails none — `carId` already identifies one car. Deleting the pre-check would make a stranger's car report €0.00 instead of 404, leaking existence. 03-02/03-03 must keep an ownership read of their own, not assume the query filter covers them |
| **Node re-reads `process.env.TZ` at runtime (Node 24)** | So a UTC-only rule can be *proven* in CI rather than asserted: `tests/unit/aggregation.test.ts` runs cases under `America/New_York` and `Asia/Tokyo`, restoring TZ in `afterEach`. Any later date bucketing (03-02's consumption series, Phase 7's intervals) should use the same technique |
| **Aggregation is JS, not SQL `date_trunc`** | Deliberate: it keeps the UTC bucketing rule reachable from unit tests with no database. Fine at personal scale; if a car ever holds enough rows to matter, replace with `groupBy` behind the same `getCarReport` signature |
| **Added Phase 9: Demo Data Seed, pulled to run next** | Milestone is now 10 phases. Hand-building a car and a dozen expenses to eyeball a report is enough friction to stop the checking happening. Pulled ahead of 03-02 because its full-tank + odometer series is the exact fixture 03-02 needs — building it afterwards means hand-building that series twice |
| **Demo data attaches to an existing user by email, never seeds the User** | With `@auth/prisma-adapter`, signing in with Google against a `User` that has no linked `Account` row is refused with `OAuthAccountNotLinked`. Seeding the user first would break login; attaching after first sign-in keeps the seed out of the auth path entirely |
| **The demo seed does NOT solve the truncation clash** | `resetDatabase()` wipes `User`/`Car`/`Expense`/`Category`, so `npm run test:integration` destroys the demo data and it must be re-seeded. Left to Phase 8 on purpose — a partial guard here would mean two safety mechanisms to keep honest |

### Deferred Issues

| Issue | Origin | Effort | Revisit |
|-------|--------|--------|---------|
| Bulgarian fines/vignette lookup mechanism unconfirmed | Ideation | M | Before Phase 5 — `/paul:discover` |
| Fines/vignette check cadence undecided | Ideation | S | After the Phase 5 spike |
| Licence unsettled — `UNLICENSED` avoids npm's default ISC grant on a public repo | Phase 0 | S | User's call, any time |
| Non-provider secret-scanning patterns unavailable — needs GitHub's paid Secret Protection tier | Phase 1 | — | Only under org licensing |

### Blockers/Concerns

| Concern | Impact | Resolution Path |
|---------|--------|-----------------|
| Next.js owns a section of AGENTS.md | Hand-edits inside the `nextjs-agent-rules` block are silently overwritten on `next dev` | Edit only outside the markers |
| e2e step rebuilds the app, duplicating the Build step | Slower CI runs | Accepted; optimising means touching 01-01's verified workflow structure |
| ~~Auth never exercised against real Google~~ **RESOLVED 2026-08-09** | A real Google sign-in was performed at 09-01's checkpoint. Verified in the database: a `User` row with a linked `Account` of provider `google` | Closed — no action outstanding |
| e2e suite asserts placeholder copy on `/` | Phase 3 turns `/` into the dashboard and will need `tests/e2e/home.spec.ts` updated | Expected, not a regression |
| **System categories exist only if `db:seed` ran** | They are global `userId: null` rows created by no runtime code, so a fresh production database gives a new user an empty category select | 02-07 owns categories — decide whether the app self-heals or deployment must seed |
| No accessibility audit has been run | WCAG AA is a stated goal; fields are labelled but contrast/focus/keyboard are unverified | Dedicated pass once the UI stops growing |

**Resolved:** CI metric + stale agent docs (02-02); `.env.example` + ARCHITECTURE schema (02-03);
the `@auth/prisma-adapter`/Prisma 7 worry — its peer range is open-ended, and compatibility was
verified functionally (02-04); PROJECT.md duplication (02-04 planning).

## Boundaries (Active)

Standing "do not break these":

- **All data paths go through `lib/session.ts`** — never build a `where` from a nullable user id
- **No Google Drive scopes** in the OAuth consent until Phase 6
- **No real credentials committed** — `AUTH_*` real values live only in `.env`

- **Never run `prisma init` again** -- re-injects 71 agent-skill files and edits `.gitignore`
- **Never run `create-next-app`** here -- clobbers README.md, .gitignore, eslint.config.mjs, scripts
- **Never edit inside AGENTS.md's `nextjs-agent-rules` markers** -- Next regenerates that block
- **Keep `afterEach(cleanup)` in `tests/unit/setup.ts`** -- looks like boilerplate, prevents DOM leaks
- ESLint stays on 9 -- `eslint-config-next`'s plugins crash on 10
- CI triggers, `permissions`, `concurrency` -- verified in 01-01, not to be restructured
- `.paul/**`, `projects/**`, `.claude/settings.json` -- untouched by tooling
- `npm run check` must stay green; the pre-push hook enforces it

### Git State

Branch: `main` · Feature branches: none (direct-to-`main` workflow)

## Session Continuity

Last session: 2026-08-09
Stopped at: Phase 9 complete and closed. **Nothing committed yet.**
Next action: Commit the Phase 9 work, then run `/paul:plan` for **03-02** (fuel efficiency)
Resume file: `.paul/phases/09-demo-data-seed/09-01-SUMMARY.md`
Git strategy: `main` (direct commits)
Resume context:
- **⚠️ Phase 9 is uncommitted.** 9 files plus `.paul/` bookkeeping. The repo's convention is three loop commits (`Create plan` / `Apply` / `Close loop`) plus a `feat(phase):` transition commit.
- **⚠️ The dev server was stopped** during 09-01's e2e verification and not restarted. `npm run dev` when needed.
- **`npm run db:seed:demo -- --email <address>` populates an account in ~1s.** Re-run it after `npm run test:integration`, which truncates everything.
- **03-02's fixture already exists.** `lib/demo-data.ts` exports `PARTIAL_FILL_INDEX`, `MISSING_READING_INDEX`, `DECREASING_READING_INDEX` — reference them rather than rediscovering the awkward rows.
- **Phase 3 is three plans**: 03-01 aggregations ✅, 03-02 fuel efficiency, 03-03 dashboard. The split was confirmed by outcome — 21 min vs 02-07's 195. Keep one concern per plan.
- **03-02 must carry its own ownership read.** Mutation-proven in 03-01: the `getCarById` pre-check is what isolates, not the relation filter. A new query that relies on the filter alone will not refuse a stranger's car — it will return an empty/zero result, leaking existence.
- **The odometer series is not monotonic.** Readings may decrease, repeat, or be missing on a fill-up. `Expense.fullTank` marks usable endpoints; `OdometerReading.expenseId` links a reading to its fill-up.
- **Prove timezone logic, do not assert it.** Node 24 re-reads `process.env.TZ`, so run date cases under `America/New_York` and `Asia/Tokyo` (restore in `afterEach`). CI is UTC, so a default-TZ assertion is vacuous.
- **Grep for absence must strip comments first** — the plan's own verify command failed this in 03-01, matching prose that said the file imports no Prisma.
- **03-03 still owns `/` and `tests/e2e/home.spec.ts`** — untouched, placeholder assertion still live.
- Integration tests must seed categories themselves: `resetDatabase()` truncates `Category`. E2E suites must too — CI runs integration immediately before e2e.
- E2E auth is solved: `tests/e2e/helpers/auth.ts` seeds a session and sets the cookie.
- Local dev needs `docker compose up -d` (Postgres on **5433**) before `npm run test:integration`.
- **Verify e2e with `CI=true`**; `npm run build` is the only type-check (Vitest is not).
- **Never read an exit code through a pipe** -- this has caused a wrong conclusion three times.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
