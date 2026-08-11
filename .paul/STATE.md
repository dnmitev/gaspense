---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-10)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release — **Phase 4 complete**. Phase 5 (Bulgarian Integrations) is
next and is **research-gated**: `/paul:discover` before it can be planned

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 5 of 10 (Bulgarian Integrations) — Not started, **research-gated**
Plan: Not started
Status: Ready to research, then plan
Last activity: 2026-08-10 — **Phase 4 complete** (4 plans, 170 tests); transitioned to Phase 5

Progress:
- Milestone: [███████░░░] 70% (7 of 10 phases complete)
- Phase 4: [██████████] 100% (4 of 4 plans) ✅
- Phase 5: [░░░░░░░░░░] 0% (blocked on a research spike)

## Loop Position

```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — Phase 4 closed, ready for /paul:discover]
```

## Performance Metrics

20 plans complete, ~14h total, ~44 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 7/7 ✅ | ~57 min |
| 03-reporting | 3/3 ✅ | ~28 min |
| 04-pwa-mobile-ux | 4/4 ✅ | ~69 min |
| 08-test-environment-safety | 2/2 ✅ | ~25 min |
| 09-demo-data-seed | 1/1 ✅ | ~20 min |

**Trend:** …**14**, **47**, **85**, **75**, **70** min. Phase 4 was the most expensive phase since
Phase 2, and **all four of its plans contained something believed, tested, and wrong until executed
for real**: two tests passing for the wrong reason (04-01), an accessibility control that could not
fire (04-02), a fixture that could not fail and hid Next's silent 1 MB body cap (04-03), and an
adapter whose stub-based tests passed while it mishandled every missing object (04-04). None were
caught by review. **Budget a third of any guarantee-shaped plan for proving the proof**, treat a
clean result from a new check as unverified until the check has been made to fail, and verify an
adapter against the real service before believing it.

## Accumulated Context

### Decisions

Only what constrains upcoming work. **Full log: `.paul/PROJECT.md` → Key Decisions.**

| Decision | Impact on what comes next |
|----------|---------------------------|
| **Isolation is app-layer, not RLS** | Every new query path needs a test proving one user cannot read another's rows. No database backstop exists |
| **Which check is load-bearing is measured, never inferred — asked five times, five different answers** | `getCarReport`'s pre-check did all the work and its relation filter none; `getFleetSummary`'s two filters are redundant; 04-01's `isNavigation` guard did **nothing** because the allowlist already refused those paths. Every time, the obvious test passed for the wrong reason. Mutation-test the guard you just wrote |
| **Look at visual output; no assertion substitutes** | 04-01's icons passed every check while rendering wrong; 04-02's screenshots revealed nothing linked to `/expenses/new`; 04-03's revealed a photo that never loaded **and** a `width`/`height` column nothing wrote to |
| **A fixture that cannot exercise the branch proves nothing about it** | 04-03's attachment tests all used a 192px icon, so the downscaler took its "leave it alone" path every time and AC-4 was never tested. Replacing the fixture is what exposed a real defect |
| **`toBeVisible()` passes on a broken image** | It only needs a non-empty box. 04-03's photo assertion passed against a 320×2 element that had not loaded. Poll `naturalWidth > 0` |
| **Three size limits on an upload, not one** | Browser downscale (1600px) → validation (2 MB, the readable one) → **Next server action body (`next.config.ts`, default 1 MB and stricter than Vercel's 4.5 MB)**. Exceeding the last one fails *silently*. Changing the downscale target means re-checking it |
| **Prove a new gate can fail before trusting a clean result** | 04-02's audit reports zero violations. Its *planned* control (strip a label's `htmlFor`) could not fire — a `placeholder` satisfies axe's accessible-name rules. Contrast is the control that works |
| **An audit's precondition must not depend on what it audits** | The a11y tests waited on `getByLabel`; with labels broken they failed on the wait and axe never ran — a control that looks like it works and does not. They wait on `#amount` now |
| **axe's measured blind spots here** | A `placeholder` satisfies accessible-name rules, and the HTML parser silently unnests `<a>` inside `<a>` so `nested-interactive` never fires. Neither is covered by the gate — the keyboard and unit tests cover the first |
| **A green CI job with a flaky annotation is not a green test — twice now** | `retries: 1` hid 04-01's service-worker race and 04-04's `document-title` race; both jobs reported success. Read `gh run view`'s ANNOTATIONS block, not just the checkmark |
| **Next applies `<title>` asynchronously after a client-side navigation** | axe can run in the window before it lands and report `document-title` as a *serious* violation. `expectAccessible` polls for a non-empty title first — waiting for content to be visible is not enough |
| **`serviceWorker.ready` resolves while the worker is still `activating`** | `clients.claim()` sets `controller` from inside `activate`, so controller precedes `activated`. Wait on `active.state === "activated"` too, or the test races |
| **`lib/session.ts` is the only way to learn the caller** | `requireUserId()` throws rather than returning falsy — Prisma reads `undefined` in `where` as "no filter" |
| **Data-layer functions take `userId` explicitly; writes use scoped `updateMany`** | Never findUnique-then-update. Scoping visible at the call site |
| **`Expense` has no `userId`** — scoped via `carId → Car.userId` | `create` has no WHERE, so ownership there is an explicit pre-check |
| **`Category.userId` is nullable — system rows are shared** | Reads use `OR: [{ userId }, { userId: null }]`; they exist only if `db:seed` ran |
| **Soft-delete cars only (`deletedAt`)** | Every car query filters `deletedAt: null`. Expenses/odometer hard-delete. The demo seed's `--clear` is a documented exception |
| **Money is `amountCents Int`; `lib/money.ts` is the only converter** | Includes `formatEurPerKm` — dividing money by distance is money changing unit. Enforced by comment-stripped audit |
| **Money-derived rates round in integer space, never `toFixed`** | `toFixed` rounds by the double's actual value, so half-way cases are unpredictable per input |
| **Schema is 6 entities** — `Attachment` landed in 04-03 | Phase 5 adds Fine/Vignette after the research spike. `Attachment.carId` and its CHECK constraint already exist, so car photos need no migration |
| **Attachment bytes live behind `lib/storage.ts`; `STORAGE_DRIVER` picks local or Supabase** | `.storage/` is gitignored and **never under `public/`**. A missing Supabase variable is a **hard failure**, never a fall back — Vercel's filesystem is ephemeral. **The Supabase bucket must be private.** Verified once by hand; nothing in CI exercises it |
| **Attachment ownership is an OR over car and expense, `deletedAt: null` on both** | All three branches mutation-proven. Scoping through `expense` alone made a car photo 404 to its own owner |
| **The suites force `STORAGE_DRIVER=local`, overwritten not defaulted** | `.env` reaches them via `dotenv/config`, so a developer's `supabase` driver would send every test upload into the real bucket. Two places: Playwright workers **and** the server under test |
| **A stub answers what it is told — verify an adapter against the real service** | The Supabase adapter's stub tests passed while it mishandled every missing object: Supabase reports not-found as **HTTP 400** with the status in the body, so `get` threw where it had to return null and the route would have 500ed |
| **Adding a driver seam adds a way for tests to reach production** | Close it in the same plan. This is Phase 8's lesson, restated for an object store |
| **`/api/attachments/[id]` returns 404, never 403** | Including for no session. A 403 confirms the id exists. A missing object returns 410, because that row *is* the caller's |
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
| **Photos carry EXIF, including GPS** | The canvas re-encode drops it as a *side effect*, not a guarantee, and the no-canvas fallback preserves it entirely. Tolerable with local storage and no deployment; not tolerable once real photos are uploaded anywhere | Settle in 04-04 or before any deploy |
| **The local storage adapter cannot be deployed** | Vercel's filesystem is ephemeral — `.storage/` works in development and would silently lose photos in production | 04-04's Supabase adapter is required, not optional |
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

Last session: 2026-08-10 — Phase 4 planned, applied and closed across four loops
Stopped at: **Phase 4 complete**, committed and pushed
Next action: `/paul:discover` for **Phase 5 — Bulgarian Integrations** (research-gated), or
`/paul:plan` for Phase 6 or 7, which depend only on Phase 2
Resume file: `.paul/ROADMAP.md`
Git strategy: `main` (direct commits)
Resume context:
- **⚠️ Phase 5 cannot be planned yet.** Neither the КАТ/МВР fines lookup nor the vignette check has
  a confirmed public API. Do not invent endpoint URLs or request shapes — run the spike first.
  Phases 6 (Drive export) and 7 (maintenance reminders) depend only on Phase 2 and are unblocked.
- **⚠️ `.env` now holds REAL Supabase credentials** (gitignored). First time real credentials for a
  hosted service exist here. `.env.example` carries placeholders only, and the repo is public.
- **⚠️ No EXIF/GPS stripping on uploaded photos** — the open item with a privacy dimension, and
  deployment is now possible. A canvas re-encode drops it as a side effect, not a guarantee.
- **⚠️ The Supabase adapter is verified once, by hand.** Nothing in CI touches it, deliberately —
  so an API change surfaces in production, not in a test run.
- **⚠️ Five routes are unaudited for accessibility** (`/cars`, `/cars/new`, the edit pages,
  `/categories`, report and odometer). Add each to `tests/e2e/accessibility.spec.ts` — one line.
- **⚠️ No real home-screen install has been performed**, carried from 04-01.
- **⚠️ `.env` also carries `TEST_DATABASE_URL`.** A fresh clone needs it from `.env.example` plus
  `npm run db:test:setup`, or the suites refuse to run.
- **⚠️ Local e2e needs port 3000 free** — `reuseExistingServer` is off.
- **581 tests:** 265 unit, 164 integration, 152 e2e.
- **Never read an exit code through a pipe** — this has caused a wrong conclusion three times.
- **`.agents/` and `skills-lock.json` are untracked and predate this work** — kept out of all
  twelve Phase 4 commits. Decide what they are before something sweeps them in.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
