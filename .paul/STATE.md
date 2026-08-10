---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-10)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release — Phase 8 (Test Environment Safety), pulled forward ahead
of Phase 4; 08-01 closed, 08-02 (the guard) ready to plan

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 8 of 10 (Test Environment Safety) — In progress
Plan: 08-01 complete
Status: Loop closed — ready to plan 08-02
Last activity: 2026-08-10 — **08-01 closed** (~36 min, 11 tests). Dev database now provably
survives a full suite run

Progress:
- Milestone: [█████░░░░░] 50% (5 of 10 phases complete)
- Phase 8: [█████░░░░░] 50% (1 of 2 plans)
- Phase 4: [░░░░░░░░░░] 0% (deferred behind Phase 8)

## Loop Position

```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — 08-01 closed, ready for next PLAN]
```

## Performance Metrics

15 plans complete, ~9.8h total, ~39 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 7/7 ✅ | ~57 min |
| 03-reporting | 3/3 ✅ | ~28 min |
| 08-test-environment-safety | 1/2 | ~36 min |
| 09-demo-data-seed | 1/1 ✅ | ~20 min |

**Trend:** …**21**, **20**, **17**, **45**, **36** min. 08-01's 36 was one thing: the plan
under-specified the e2e wiring, so the first full e2e run failed 88/88 and had to be diagnosed.
The plan was wrong, not the code — **infrastructure plans need a task per *process* that touches
the resource**, not per file. Playwright alone has two (server, workers).

## Accumulated Context

### Decisions

Only what constrains upcoming work. **Full log: `.paul/PROJECT.md` → Key Decisions.**

| Decision | Impact on what comes next |
|----------|---------------------------|
| **Isolation is app-layer, not RLS** | Every new query path needs a test proving one user cannot read another's rows. No database backstop exists |
| **Which scope filter is load-bearing is measured, never inferred** | `getCarReport`'s pre-check did all the work and its relation filter none; `getFleetSummary`'s two filters are redundant with each other. Same question, different answers — mutation-test each new query shape |
| **`lib/session.ts` is the only way to learn the caller** | `requireUserId()` throws rather than returning falsy — Prisma reads `undefined` in `where` as "no filter" |
| **Data-layer functions take `userId` explicitly; writes use scoped `updateMany`** | Never findUnique-then-update. Scoping visible at the call site |
| **`Expense` has no `userId`** — scoped via `carId → Car.userId` | `create` has no WHERE, so ownership there is an explicit pre-check |
| **`Category.userId` is nullable — system rows are shared** | Reads use `OR: [{ userId }, { userId: null }]`; they exist only if `db:seed` ran |
| **Soft-delete cars only (`deletedAt`)** | Every car query filters `deletedAt: null`. Expenses/odometer hard-delete. The demo seed's `--clear` is a documented exception |
| **Money is `amountCents Int`; `lib/money.ts` is the only converter** | Includes `formatEurPerKm` — dividing money by distance is money changing unit. Enforced by comment-stripped audit |
| **Money-derived rates round in integer space, never `toFixed`** | `toFixed` rounds by the double's actual value, so half-way cases are unpredictable per input |
| **Schema is 5 entities** | Phase 4 adds `Attachment`; Phase 5 adds Fine/Vignette after the research spike |
| **Prisma 7: adapter mandatory, URLs in `prisma.config.ts`, scripts under `tsx`** | Never `new PrismaClient()` bare; the generated client's imports are bundler-style |
| **Migrations generated non-interactively** | `migrate dev` refuses headless and Prisma 7 blocks `migrate reset` under Claude Code. Use `migrate diff`, prove with `migrate deploy` |
| **Mutations are server actions; reads in server components** | No REST routes. `docs/ARCHITECTURE.md`'s REST table was a design sketch |
| **Hand-rolled Tailwind, no component library; charts are hand-rolled SVG** | The app ships almost no client JavaScript — the strongest possible starting point for Phase 4's PWA. The only client components are Phase 2's forms and delete buttons |
| **`/` requires a session** | It is a server component reading auth, so it cannot be unit-tested under jsdom. Page coverage is e2e; jsdom renders only auth-free components |
| **Unit tests DB-free; integration separate** | `npm test` must keep passing with Docker stopped. Pure modules (`aggregation`, `consumption`, `chart`, `demo-data`) import nothing |
| **Vitest does not type-check; `next build` does** | Run both. Also: a failed test *file* reports "all passed" — read the exit code, not the summary |
| **Two databases: `gaspense_dev` and `gaspense_test`** | `TEST_DATABASE_URL` wins and *overwrites* `DATABASE_URL` for the run; unset, it falls back to `DATABASE_URL` (how CI works). 08-02's guard is what makes that fallback safe |
| **Assert connection reality, not configuration** | `current_database()`, never reading the env var back — the latter only proves setup ran, not that setupFiles beat module-scope clients |
| **Infrastructure plans need a task per *process*, not per file** | 08-01's plan wired Playwright's server and forgot its workers; 88/88 e2e failed. Ask which processes touch the resource |
| **`reuseExistingServer` is off** | A reused `npm run dev` serves `gaspense_dev` while helpers write `gaspense_test`. Local e2e needs port 3000 free and fails loudly if not |
| **e2e suites seed their own global fixtures** | `npm run test:integration` truncates `Category`, and CI runs it immediately before e2e |
| **Assert against comment-stripped source, with a positive control** | Grep for absence matches prose otherwise. An audit reporting zero hits *everywhere* proves nothing |
| **Prove timezone logic, do not assert it** | Node re-reads `process.env.TZ` at runtime; CI is UTC so a default-TZ assertion is vacuous |
| **A silent no-op replace passes the build** | Grep for the thing itself and read the match |
| **`AUTH_URL` required for a production build** | Auth.js rejects every session read with UntrustedHost otherwise |
| **NextAuth v5 + database sessions** | Phase 6's Drive export needs the persisted `Account.refresh_token` |
| **Demo data attaches to an existing user by email, never seeds a `User`** | Seeding one first breaks Google sign-in with `OAuthAccountNotLinked` |
| **CLAUDE.md and AGENTS.md always change together** | One set of facts in two files |
| **Direct commits to `main`; push after every loop** | The pre-push hook is the only pre-landing gate |
| **Public repo — nothing sensitive, ever** | Placeholder plates and no real personal data in seeds, fixtures or docs |

### Deferred Issues

| Issue | Origin | Effort | Revisit |
|-------|--------|--------|---------|
| Bulgarian fines/vignette lookup mechanism unconfirmed | Ideation | M | Before Phase 5 — `/paul:discover` |
| Fines/vignette check cadence undecided | Ideation | S | After the Phase 5 spike |
| Licence unsettled — `UNLICENSED` avoids npm's default ISC grant | Phase 0 | S | User's call, any time |
| Non-provider secret-scanning patterns unavailable | Phase 1 | — | Only under org licensing |
| Playwright's port is hard-coded to 3000 | 03-02 | S | Now **fails loudly** rather than silently reusing a dev server (08-01). Still worth making configurable |

### Blockers/Concerns

| Concern | Impact | Resolution Path |
|---------|--------|-----------------|
| **`resetDatabase()` truncates without checking its target** | It no longer *aims* at the dev database (08-01), but nothing stops it firing at a wrong one — e.g. an exported production URL with `TEST_DATABASE_URL` unset | **08-02 owns this.** Host-and-name guard derived from the URL, with tests proving the refusal fires |
| **AC-6 (CI unedited) is proven locally, not in CI** | `ci.yml` was deliberately untouched and relies on the `DATABASE_URL` fallback | Confirmed by the next push — watch that run |
| No accessibility audit has been run | WCAG AA is a stated goal. Landmarks and chart labelling exist; contrast, focus order and keyboard nav are unverified | Phase 4 is where this matters most — mobile UX |
| System categories exist only if `db:seed` ran | A fresh production database gives a new user an empty category select | Decide whether the app self-heals or deployment must seed |
| Next.js owns a section of AGENTS.md | Hand-edits inside `nextjs-agent-rules` are overwritten on `next dev` | Edit only outside the markers |
| e2e step rebuilds the app, duplicating the Build step | Slower CI runs | Accepted; optimising means touching 01-01's verified structure |

**Resolved:** CI metric + stale agent docs (02-02); `.env.example` + ARCHITECTURE schema (02-03);
`@auth/prisma-adapter`/Prisma 7 compatibility (02-04); real Google login, never previously
exercised (09-01); the `/` placeholder assertion in `tests/e2e/home.spec.ts` (03-03).

## Boundaries (Active)

- **All data paths go through `lib/session.ts`** — never build a `where` from a nullable user id
- **No Google Drive scopes** in the OAuth consent until Phase 6
- **No real credentials committed** — `AUTH_*` real values live only in `.env`
- **Never run `prisma init` again** — re-injects 71 agent-skill files and edits `.gitignore`
- **Never run `create-next-app`** here — clobbers README.md, .gitignore, eslint.config.mjs, scripts
- **Never edit inside AGENTS.md's `nextjs-agent-rules` markers**
- **Keep `afterEach(cleanup)` in `tests/unit/setup.ts`** — looks like boilerplate, prevents DOM leaks
- ESLint stays on 9 — `eslint-config-next`'s plugins crash on 10
- CI triggers, `permissions`, `concurrency` — verified in 01-01, not to be restructured
- `.paul/**`, `projects/**`, `.claude/settings.json` — untouched by tooling
- `npm run check` must stay green; the pre-push hook enforces it

### Git State

Branch: `main` · Feature branches: none (direct-to-`main` workflow)

## Session Continuity

Last session: 2026-08-10 — 08-01 planned, applied and closed
Stopped at: 08-01 loop closed and committed
Next action: `/paul:plan` for **08-02 — the guard**
Resume file: `.paul/phases/08-test-environment-safety/08-01-SUMMARY.md`
Git strategy: `main` (direct commits)
Resume context:
- **08-02 is the rest of the phase:** `resetDatabase()` must refuse a target that is not
  demonstrably a test database — host-and-name derived from the URL, no opt-in flag. CI already
  satisfies such a guard (`localhost` + `gaspense_test`); **verify that, do not assume it.**
- **⚠️ The phase directory holds 1 PLAN and 1 SUMMARY**, which the file-count heuristic reads as
  "phase complete". It is not — ROADMAP says 2 plans and is the authority. Third occurrence of
  this false signal in this project.
- **⚠️ `.env` now carries `TEST_DATABASE_URL`** (appended, gitignored). A fresh clone needs it
  from `.env.example` plus `npm run db:test:setup`.
- **⚠️ Local e2e needs port 3000 free** — `reuseExistingServer` is off, so it fails rather than
  reusing the wrong server. Identify a process through its parent chain before killing anything.
- **395 tests:** 176 unit, 131 integration, 88 e2e.
- **Never read an exit code through a pipe** — this has caused a wrong conclusion three times.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
