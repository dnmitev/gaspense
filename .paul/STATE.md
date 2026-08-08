---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-07)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release, Phase 2: Foundations — 02-06 applied

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 2 of 8 (Foundations) — In progress
Plan: 02-06 executed, 7 of 7 tasks complete (checkpoint approved)
Status: APPLY complete, ready for UNIFY
Last activity: 2026-08-08 — Applied 02-06: expenses live, 161 tests green, split fuel/other entry added at review

Progress:
- Milestone: [██░░░░░░░░] 25% (2 of 8 phases complete)
- Phase 2: [████████░░] 86% (6 of 7 plans)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ◉     [Ready for UNIFY]
```

## Performance Metrics

8 plans complete, ~3.5h total, ~26 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 5/7 | ~31 min |

**Trend:** 13, 9, 29, 33, 14, 35, 45, 28 min. Cost tracks how much *unknown third-party
behaviour* a plan touches, not its size — 02-05 was the largest by files yet mid-pack, because
the stack was already understood.

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
| Auth is wired but never exercised against real Google | A real OAuth login has not been performed; seeded DB sessions are what the tests use | User adds `AUTH_*` to `.env` and clicks through when convenient |
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

Last session: 2026-08-07 (resumed; handoff consumed and archived to `.paul/handoffs/archive/`)
Stopped at: Plan 02-06 applied and approved at its checkpoint
Next action: Run `/paul:unify .paul/phases/02-foundations/02-06-PLAN.md` to close the loop
Resume file: `.paul/phases/02-foundations/02-06-PLAN.md`
Git strategy: `main` (direct commits)
Resume context:
- Phase 2 is now **5 of 7** — the last plan was split into 02-06 (Expense + money) and 02-07 (Category + Odometer), so **02-07**, not 02-06, triggers the phase transition. The file-count heuristic has false-positived six times; ROADMAP remains the authority.
- **02-06 copies 02-05's vertical slice**: `lib/cars.ts`, `app/cars/actions.ts`, and `tests/integration/cars.test.ts` are the templates.
- **02-07 gained scope at the 02-06 review**: the odometer must be capturable on the expense form, not only as a standalone log (`OdometerSource.EXPENSE` already exists for it). Phase 3 gained L/100km; a new Phase 7 covers maintenance intervals.
- Integration tests must seed categories themselves: `resetDatabase()` truncates `Category`.
- E2E auth is solved: `tests/e2e/helpers/auth.ts` seeds a session and sets the cookie.
- Local dev needs `docker compose up -d` (Postgres on **5433**) before `npm run test:integration`.
- **Never read an exit code through a pipe** -- this has caused a wrong conclusion three times.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
