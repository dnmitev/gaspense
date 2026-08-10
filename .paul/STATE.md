---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-10)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release — Phase 4 (PWA & Mobile UX); 04-01 (installable PWA) and
04-02 (quick-add + the first accessibility audit) complete, 04-03 (attachments) remains

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 4 of 10 (PWA & Mobile UX) — In progress
Plan: 04-02 complete ✅ — all 6 ACs pass, 46 tests added
Status: Loop closed, ready to plan 04-03
Last activity: 2026-08-10 — **04-02 complete**: three taps to one, and an accessibility gate whose blind spots are measured

Progress:
- Milestone: [██████░░░░] 60% (6 of 10 phases complete)
- Phase 4: [███████░░░] 67% (2 of 3 plans) — 04-03 attachments remains

## Loop Position

```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — ready for 04-03]
```

## Performance Metrics

18 plans complete, ~12h total, ~41 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 7/7 ✅ | ~57 min |
| 03-reporting | 3/3 ✅ | ~28 min |
| 04-pwa-mobile-ux | 2/3 | ~66 min |
| 08-test-environment-safety | 2/2 ✅ | ~25 min |
| 09-demo-data-seed | 1/1 ✅ | ~20 min |

**Trend:** …**45**, **36**, **14**, **47**, **85** min. Phase 4 is the most expensive phase since
Phase 2, and the pattern is consistent across both plans: **most of the overrun was spent
discovering that the tests proving the deliverable did not prove it.** 04-01 rewrote two; 04-02
found its planned accessibility control could not fire at all. Neither would have been caught by
review, only by deliberately breaking things. **Budget a third of any guarantee-shaped plan for
proving the proof** — 04-03's upload path is the same shape again.

## Accumulated Context

### Decisions

Only what constrains upcoming work. **Full log: `.paul/PROJECT.md` → Key Decisions.**

| Decision | Impact on what comes next |
|----------|---------------------------|
| **Isolation is app-layer, not RLS** | Every new query path needs a test proving one user cannot read another's rows. No database backstop exists |
| **Which check is load-bearing is measured, never inferred — three for three** | `getCarReport`'s pre-check did all the work and its relation filter none; `getFleetSummary`'s two filters are redundant; 04-01's `isNavigation` guard did **nothing** because the allowlist already refused those paths. Every time, the obvious test passed for the wrong reason. Mutation-test the guard you just wrote |
| **Look at visual output; no assertion substitutes** | 04-01's icons passed every automated check while rendering as a small glyph in the top-left corner. Opening the PNG is what caught it. 04-02's screenshots are what revealed nothing linked to `/expenses/new` |
| **Prove a new gate can fail before trusting a clean result** | 04-02's audit reports zero violations. Its *planned* control (strip a label's `htmlFor`) could not fire — a `placeholder` satisfies axe's accessible-name rules. Contrast is the control that works |
| **An audit's precondition must not depend on what it audits** | The a11y tests waited on `getByLabel`; with labels broken they failed on the wait and axe never ran — a control that looks like it works and does not. They wait on `#amount` now |
| **axe's measured blind spots here** | A `placeholder` satisfies accessible-name rules, and the HTML parser silently unnests `<a>` inside `<a>` so `nested-interactive` never fires. Neither is covered by the gate — the keyboard and unit tests cover the first |
| **A green CI job with a flaky annotation is not a green test** | `retries: 1` hid 04-01's AC-3 race entirely — the job reported success. Read `gh run view`'s ANNOTATIONS block, not just the checkmark |
| **`serviceWorker.ready` resolves while the worker is still `activating`** | `clients.claim()` sets `controller` from inside `activate`, so controller precedes `activated`. Wait on `active.state === "activated"` too, or the test races |
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
| **Hand-rolled Tailwind, no component library; charts are hand-rolled SVG** | Client components: Phase 2's forms and delete buttons, plus 04-01's worker registration in the shell (renders `null`). That last one is the cost of installability, not a precedent |
| **The service-worker cache is an allowlist — never HTML, never `/api`** | Widening it is a **security** change, not a performance tweak: a cached navigation outlives the session that authorised it. Re-run the AC-4 tests in `tests/e2e/pwa.spec.ts` if you touch it |
| **`CACHE_VERSION` in `public/sw.js` is bumped by hand** | Change the precache list without bumping and stale entries survive. Same shape of unenforced obligation as "a new destructive path needs its own `assertTestDatabase`" |
| **`public/sw.js` is the one plain-JS file, an ES module worker** | Its types live in `types/sw.d.ts`, deliberately outside `public/` — everything there is publicly fetchable. Registration is production-only |
| **`/` requires a session** | It is a server component reading auth, so it cannot be unit-tested under jsdom. Page coverage is e2e; jsdom renders only auth-free components |
| **Unit tests DB-free; integration separate** | `npm test` must keep passing with Docker stopped. Pure modules (`aggregation`, `consumption`, `chart`, `demo-data`) import nothing |
| **Vitest does not type-check; `next build` does** | Run both. Also: a failed test *file* reports "all passed" — read the exit code, not the summary |
| **Two databases: `gaspense_dev` and `gaspense_test`** | `TEST_DATABASE_URL` wins and *overwrites* `DATABASE_URL` for the run; unset, it falls back to `DATABASE_URL` (how CI works), and the guard makes that fallback safe |
| **Destructive test paths are guarded: local host AND `_test` name** | Covers `resetDatabase` and `createTestClient`. **A new mass-destruction path needs its own `assertTestDatabase` call** — nothing enforces this automatically |
| **Aim a refusal test where a broken guard cannot do damage** | Never at `gaspense_dev`. Use `postgres` — local, reachable, wrong-named, holding none of the app's tables |
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
| The accessibility gate covers 4 of 9 routes | 04-02 gave the project its first real gate — zero serious/critical on `/signin`, `/`, and both add forms, on both viewports. `/cars`, `/cars/new`, the edit pages, `/categories`, and the report and odometer pages are **not** audited, and the gate has two measured blind spots. It is a gate, not a WCAG AA certification | Add pages to `tests/e2e/accessibility.spec.ts` — one line each |
| No real home-screen install has been performed | Everything installability *requires* is proven by test (complete manifest, maskable icon, controlling fetch-handling worker, secure origin), but the device install is not. Same shape of gap as the Google login open from 02-04 to 09-01 | Install it on a phone once, or run Lighthouse |
| System categories exist only if `db:seed` ran | A fresh production database gives a new user an empty category select | Decide whether the app self-heals or deployment must seed |
| Next.js owns a section of AGENTS.md | Hand-edits inside `nextjs-agent-rules` are overwritten on `next dev` | Edit only outside the markers |
| e2e step rebuilds the app, duplicating the Build step | Slower CI runs | Accepted; optimising means touching 01-01's verified structure |

**Resolved:** **the whole Phase 8 exposure** — the suite can destroy neither the dev database
(08-01, identical row counts across a full run) nor any other (08-02, the misconfiguration now
exits refusing); the `DATABASE_URL` fallback in CI, green on run 31382960251 with `ci.yml`
unedited; CI metric + stale agent docs (02-02); `.env.example` + ARCHITECTURE schema (02-03);
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

Last session: 2026-08-10 — 04-01 and 04-02 both planned, applied, closed and pushed
Stopped at: 04-02 complete, committed and pushed
Next action: `/paul:plan` for **04-03 — `Attachment` + Supabase Storage + photo upload**
Resume file: `.paul/phases/04-pwa-mobile-ux/04-02-SUMMARY.md`
Git strategy: `main` (direct commits)
Resume context:
- **04-03 closes Phase 4: `Attachment` — the first schema change since 02-07 — plus Supabase Storage
  and photo upload on cars and expenses.**
- **⚠️ 04-03 needs a real Supabase project** with credentials in `.env` before it can be verified
  end-to-end. The user has taken that on. Expect a human-action checkpoint in the plan.
- **⚠️ The migration must be generated with `migrate diff` and proven with `migrate deploy`** —
  `migrate dev` refuses headless and Prisma 7 blocks `migrate reset` under Claude Code.
- **⚠️ Add the upload pages to `tests/e2e/accessibility.spec.ts`** — one line each. The gate exists
  now; a new UI that skips it is the gap reopening.
- **⚠️ A file upload is a new write path with a new trust boundary.** Size, MIME type and ownership
  all need validating, and the isolation test must prove one user cannot read another's attachment.
- **⚠️ Mutation-test what you write — four for four now.** 04-02's planned a11y control could not
  fire at all; only a contrast regression proved the gate works.
- **⚠️ `.env` carries `TEST_DATABASE_URL`** (gitignored). A fresh clone needs it from
  `.env.example` plus `npm run db:test:setup`, or the suites refuse to run.
- **⚠️ Local e2e needs port 3000 free** — `reuseExistingServer` is off, so it fails rather than
  reusing the wrong server. Identify a process through its parent chain before killing anything.
- **490 tests:** 218 unit, 142 integration, 130 e2e.
- **Never read an exit code through a pipe** — this has caused a wrong conclusion three times.
- **`.agents/` and `skills-lock.json` are untracked and predate this session** — deliberately left
  out of every 04-01 and 04-02 commit. Decide what they are before something sweeps them in.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
