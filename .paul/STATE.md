---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-10)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release — Phase 3 closed; Phase 4 (PWA & Mobile UX) ready to plan

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 4 of 10 (PWA & Mobile UX) — Not started
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-10 — **Phase 3 complete** (3 plans, 116 tests); transitioned to Phase 4

Progress:
- Milestone: [█████░░░░░] 50% (5 of 10 phases complete)
- Phase 3: [██████████] 100% (3 of 3 plans) ✅
- Phase 4: [░░░░░░░░░░] 0% (not started)

## Loop Position

```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — Phase 3 closed, ready for next PLAN]
```

## Performance Metrics

14 plans complete, ~9.2h total, ~40 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 7/7 ✅ | ~57 min |
| 03-reporting | 3/3 ✅ | ~28 min |
| 09-demo-data-seed | 1/1 ✅ | ~20 min |

**Trend:** …195, **21**, **20**, **17**, **45** min. The single-concern split held at 21/20/17
while adding 36/40/41 tests. 03-03's 45 was not implementation difficulty: a test outside the
plan's scope broke and needed replacing, a mutation comment needed correcting after measurement,
and the dev server blocked e2e a third time. Keep splitting; expect the last plan of a phase to
cost more than its siblings.

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
| **Verify e2e with `CI=true`** | `reuseExistingServer` can silently reuse a stale dev server |
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
| Playwright's port is hard-coded to 3000 | 03-02 | S | Offered and declined twice; has now blocked e2e three times |

### Blockers/Concerns

| Concern | Impact | Resolution Path |
|---------|--------|-----------------|
| **The integration suite truncates the dev database** | It wiped the signed-in Google account twice in one session, costing a re-login and a re-seed each time | **Phase 8 owns this. Consider pulling it before Phase 4** — the cost is now real, not theoretical |
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

Last session: 2026-08-10 — **paused** (see `.paul/HANDOFF-2026-08-10.md`)
Stopped at: Phase 3 complete, closed, committed and pushed. CI green. Working tree clean.
Next action: **Decide Phase 4 vs pulling Phase 8 forward**, then `/paul:plan`
Resume file: `.paul/HANDOFF-2026-08-10.md`
Git strategy: `main` (direct commits) · HEAD `5da7b3b` == `origin/main`
Resume context:
- **Nothing is in progress.** No uncommitted work, no partial plan, no open checkpoint. This is a clean boundary.
- **An open decision, the user's to make:** Phase 4 (PWA & Mobile UX) as the roadmap orders it, or pull Phase 8 (Test Environment Safety) forward first. Phase 8 is recommended — the integration suite wiped the signed-in Google account twice in one session, and Phase 4 means far more time in the running app.
- **⚠️ Environment needs restoring before the app works:** `docker compose up -d`, `npm run dev`, sign in with Google (the account row was truncated), then `npm run db:seed:demo -- --email <address>`.
- **⚠️ Port 3000 has blocked e2e three times**, always the user's `npm run dev`. Identify the process through its parent chain before killing anything.
- **384 tests:** 167 unit, 129 integration, 88 e2e.
- **Never read an exit code through a pipe** — this has caused a wrong conclusion three times.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
