---
description: "gaspense — milestone and phase structure"
type: Roadmap
about: "gaspense"
---

# Roadmap: Gaspense

## Overview

From a graduated PLANNING.md to a working personal vehicle expense tracker: first make the repo AI- and CI-friendly, then build core tracking and reporting, then mobile/PWA polish, then the two integrations that need external research (Bulgarian fines/vignette, Google Drive export).

## Current Milestone

**v0.1 Initial Release** (v0.1.0)
Status: In progress
Phases: 7 of 10 complete (70%) — Phase 4 closed 2026-08-10. **Phase 5 (Bulgarian Integrations) is
in progress, 1 of 2 plans**: discovery done 2026-08-11 (both endpoints verified live), the vignette
check shipped in 05-01, and fines remain in 05-02

## Phases

**Phase Numbering:** Integer phases only for now (0–9). Decimal phases (e.g. 2.1) reserved for
urgent insertions later.

**Numbering is not execution order.** Phases 7, 8 and 9 are all numbered after the existing work
so numbering stays stable, not because they matter least — each depends only on Phase 2 and can
be pulled forward. Phase 9 was pulled ahead of the rest of Phase 3 and is now complete.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 0 | AI-Friendly Project Scaffolding | 2/2 | ✅ Complete | 2026-08-07 |
| 1 | CI/CD Pipeline | 1/1 | ✅ Complete | 2026-08-07 |
| 2 | Foundations | 7/7 | ✅ Complete | 2026-08-08 |
| 3 | Reporting | 3/3 | ✅ Complete | 2026-08-10 |
| 4 | PWA & Mobile UX | 4/4 | ✅ Complete | 2026-08-10 |
| 5 | Bulgarian Integrations | 1/2 | In progress — **current** | - |
| 6 | Google Drive Export | TBD | Not started | - |
| 7 | Maintenance Reminders | TBD | Not started | - |
| 8 | Test Environment Safety | 2/2 | ✅ Complete | 2026-08-10 |
| 9 | Demo Data Seed | 1/1 | ✅ Complete | 2026-08-09 |

## Phase Details

### Phase 0: AI-Friendly Project Scaffolding

**Goal:** Any AI coding agent or human contributor opening the repo has full project context and consistent code style without re-deriving them per session.
**Depends on:** Nothing (first phase)
**Research:** Unlikely (established conventions — CLAUDE.md, AGENTS.md, docs, lint config)

**Scope:**
- `CLAUDE.md` — stack, conventions, test/build commands, where PLANNING.md/PAUL state live
- `AGENTS.md` — same core context in the open agents.md cross-tool standard
- `docs/ARCHITECTURE.md` — living summary of data model, API surface, phase roadmap
- `.gitignore` — public-repo secret and artifact protection
- Lint/format config (ESLint, Prettier, EditorConfig, markdownlint)
- `npm run check` — CI-callable gate for docs presence + style, consumed by Phase 1

**Plans:**
- [x] 00-01: Agent entry-point docs (CLAUDE.md, AGENTS.md), docs/ARCHITECTURE.md, and .gitignore
- [x] 00-02: Minimal package.json + ESLint/Prettier/EditorConfig/markdownlint + CI-callable check script

**Completed 2026-08-07.** Delivers `npm run check` — the gate Phase 1 wires into GitHub Actions.

### Phase 1: CI/CD Pipeline

**Goal:** Every subsequent phase's code is automatically linted, tested, and build-checked before reaching `main`; the public repo is protected against leaked secrets from day one.
**Depends on:** Phase 0 (lint/format config must exist for CI to run against)
**Research:** Unlikely (standard GitHub Actions patterns)

**Scope:**
- GitHub Actions workflow running `npm ci` + `npm run check` on pushes to `main` **and** PRs
- Version-controlled pre-push hook enforcing the same gate locally
- Secret scanning + push protection verified active (hardening with non-provider patterns
  proved infeasible — see completion note below)

**⚠️ Carried from Phase 0:** there is deliberately no `test` script and no build until Phase 2.
The workflow must pass with what exists today (`npm run check` only) and gain `build`/`test`
steps when Phase 2 lands — a workflow written against tests that do not exist will fail on
day one.

**Verified against the live repo during planning:**
- Secret scanning and push protection were **already enabled** (GitHub's default for public
  repos), so this phase hardens rather than enables them.
- A `pull_request`-only trigger would never fire, because this project commits directly to
  `main`. Hence the `push` trigger, and hence the local pre-push hook — CI alone reports
  after the fact and cannot prevent a bad commit landing.
- No branch protection: required status checks would block the authorised direct-to-main flow.

**Plans:**
- [x] 01-01: CI workflow, version-controlled pre-push hook, secret-scanning verification, docs

**Completed 2026-08-07.** CI proven to both pass and fail. Non-provider secret-scanning
patterns turned out to be infeasible on a personal-account public repo (paid Secret
Protection tier only) — recorded as out of scope rather than skipped.

**⚠️ For Phase 2:** add `build` and `test` steps to the existing `.github/workflows/ci.yml`
and update the "not available yet" wording in *both* CLAUDE.md and AGENTS.md in the same
commit. Missing one leaves agents with contradictory instructions.

### Phase 2: Foundations

**Goal:** A user can log in, add a car, and record expenses against categories.
**Depends on:** Phase 1 (CI must be in place before feature code lands)
**Research:** Unlikely (NextAuth + Prisma CRUD are well-established patterns), but the
`eslint-config-next` flat-config entry point and the installed Tailwind major version must be
read from the packages rather than assumed.

**Scope:**
- Next.js App Router app + Tailwind, coexisting with the Phase 0 lint setup
- Test infrastructure (Vitest + Playwright) and the `build`/`test` CI steps Phase 1 deferred
- Prisma schema, migrations, and seeded default categories
- Google OAuth login (NextAuth) with per-user data isolation
- Car CRUD (soft delete), Category CRUD, Expense CRUD, Odometer log

**Decisions settled at planning time:**
- **NextAuth kept** over Supabase Auth — Phase 6's Drive export needs control of Google OAuth
  scopes and refresh tokens, which Supabase Auth does not manage. Cost: per-user isolation is
  enforced in the data layer, not by Postgres RLS, so every query path must be tested for it.
- **Prisma** as the data layer. Needs deliberate connection-pooling care on Vercel serverless.
- **Vitest + Playwright** for unit/integration and e2e.
- **Soft-delete cars only** (`deletedAt`); expenses and odometer readings hard-delete. Deleting a
  car must not destroy its expense history.

**Plans:**
- [x] 02-01: Next.js App Router scaffold, eslint-config-next integration, build step in CI
- [x] 02-02: Vitest + Playwright, `test`/`test:e2e`/`start` scripts + CI steps, agent docs corrected
- [x] 02-03: Prisma 7 schema + migrations + seeded categories, `.env.example`, `docs/ARCHITECTURE.md` update
- [x] 02-04: NextAuth v5 Google OAuth, database sessions, `lib/session.ts` scoping helper, isolation proven
- [x] 02-05: Car CRUD vertical slice — server actions, scoped data layer, soft delete, authenticated e2e
- [x] 02-06: Expense CRUD vertical slice + the money helper (euro↔cent conversion in one place)
- [x] 02-07: Category CRUD (own rows only), the Odometer log, and odometer capture on fuel entry

**Added to 02-07 during 02-06 review:** the odometer must also be capturable *on the
expense form*, not only as a standalone log — the schema already anticipates this with
`OdometerSource.EXPENSE`. Recording mileage at each fill-up is what makes Phase 3's
litres-per-100km and Phase 7's service intervals possible, so it is a prerequisite for
both rather than a convenience.

**Completed 2026-08-08.** The phase goal is met: a user can log in, add a car, and record
expenses against categories they control. 227 tests — 85 unit, 89 integration, 53 e2e — with
every entity's cross-user isolation proven by a test that re-reads the victim's row.

**⚠️ For Phase 3:** the odometer series may be **out of order or have gaps**. Readings are
deliberately not required to increase (odometers get replaced and corrected), and a fill-up
may carry no reading at all. Litres-per-100km must handle both rather than assume a clean
ascending series. `Expense.fullTank` marks which fills are usable as endpoints.

**⚠️ Also for Phase 3:** `/` still asserts placeholder copy in `tests/e2e/home.spec.ts`, which
turning it into the dashboard will break. Expected, not a regression.

**Split at 02-06 planning time.** The original single plan bundled four vertical slices
(money helper, Category, Expense, Odometer) against a 2-3 task guideline; 02-05 spent 28
minutes on one slice. Expense is separated because it is the phase goal's payload and the
first money surface. Category writes join Odometer in 02-07 because system categories
(`userId: null`) are shared across all users — making them writable is its own isolation
problem, not a footnote to expense entry.

### Phase 3: Reporting

**Goal:** A user can see fuel cost per month/year and cost breakdown by category.
**Depends on:** Phase 2 (needs Car/Expense/Category data to aggregate)
**Research:** Unlikely (standard SQL aggregation + charting)

**Scope:**
- Monthly/yearly fuel and category cost aggregations
- Dashboard charts, cost-per-km calculation
- **Fuel consumption in litres per 100 km**, computed from consecutive full-tank fill-ups
  and their odometer readings. `fullTank` and `liters` exist on Expense for exactly this;
  the calculation needs the odometer capture that 02-07 adds, and must handle partial
  fills and gaps in the series rather than assuming every fill-up is complete.

**Split into three plans at planning time (2026-08-09).** The phase bundles three
distinct concerns — SQL-shaped aggregation, a pure calculation with awkward edge cases,
and a charted dashboard — which is exactly the shape that made 02-07 cost 195 minutes.
One concern per plan.

**Confirmed by outcome:** 03-01 closed in ~21 minutes with 36 tests added. The split is
paying for itself; do not re-bundle 03-02 and 03-03.

**⚠️ For 03-02, found in 03-01 by mutation testing:** isolation on the report path is
enforced by the `getCarById` **pre-check**, not by the `car: ownedCar(userId)` relation
filter — dropping the pre-check fails three tests, dropping the filter fails none. Any new
query must carry its own ownership read; relying on the filter alone returns an empty or
zero result for a stranger's car instead of refusing, which leaks existence.

**Decided at planning time:** reports are **per car** first. It reuses the existing
car-scoped data layer and its proven isolation pattern unchanged; the all-cars roll-up
becomes the dashboard's job in 03-03 rather than a second scoping shape in 03-01.

**Plans:**
- [x] 03-01: Cost aggregations — all-time/yearly/monthly/by-category totals over a
      DB-free calculation module and a scoped query, at `/cars/[id]/report`
- [x] 03-02: Fuel efficiency — litres per 100 km from full-tank pairs, and cost-per-km;
      must survive gaps, partial fills, and a non-ascending odometer series
- [x] 03-03: Dashboard — `/` becomes the dashboard with charts and the fleet roll-up;
      updates `tests/e2e/home.spec.ts`

**Completed 2026-08-10.** Three plans, ~83 minutes, 116 tests added (384 total). The phase goal
was "fuel cost per month/year and cost breakdown by category" — met, and exceeded with
cost-per-kilometre, litres per 100 km, and a dashboard.

**⚠️ For Phase 4:** every page is a server component and the app ships almost no client
JavaScript, which is the strongest possible starting point for a PWA. Do not casually introduce a
client boundary; the only ones that exist are Phase 2's forms and delete buttons, and each earned
it with genuine interactivity.

**⚠️ Also for Phase 4:** no accessibility audit has been run project-wide. 03-01 added section
landmarks and 03-03 added `role="img"`, `aria-label` and per-bar `<title>`, but contrast, focus
order and keyboard navigation are unverified — and mobile UX is where that matters most.

**⚠️ For 03-03, from 03-02:** the fleet roll-up will be the first query in the project *not*
scoped to a single car id. The 03-01 mutation finding — that ownership is enforced by the
`getCarById` pre-check rather than the relation filter — does not transfer to a different query
shape automatically. It needs its own ownership reasoning and its own isolation test.

**Already available to 03-03:** `intervals` from `getCarEfficiency` are chart-ready (dated
endpoints, distance, litres, rate), and `formatEurPerKm` exists for any rate the dashboard shows.

**Settled at 03-03 planning time (2026-08-10) — the chart question 03-01 and 03-02 deferred:**

- **Hand-rolled inline SVG, no charting library.** Twelve rectangles do not justify a client
  boundary or ~150KB of dependency, and every page in this app is a server component. Phase 4
  turns it into a PWA, where bundle size is a stated concern. Consistent with the standing
  "hand-rolled Tailwind, no component library" decision.
- **No client components at all in this plan.** The chart renders without JavaScript.
- **The dashboard shows** the fleet total, a twelve-month spend chart, and a card per car with
  its total and consumption, each linking to that car's report. A per-car consumption trend chart
  was considered and excluded — a second chart shape in the last plan of a phase.
- **`/` redirects to `/signin` when signed out**, matching every other page. No public landing
  page: nothing about a personal tool needs one, and it would add a second auth shape.
- **⚠️ The scoping inversion.** `getFleetSummary` has no single car id, so the `getCarById`
  pre-check that carried isolation in 03-01 and 03-02 has no analogue. Ownership is resolved via
  `listActiveCars` and the resulting id set, *and* the relation filter is kept. 03-03 must
  mutation-test **both independently** and record which is load-bearing — the answer surprised us
  in 03-01 and must not be assumed here.

**Settled at 03-02 planning time (2026-08-09):**

- **Full-to-full method, partial fills absorbed.** An interval runs between two full tanks and
  counts every litre put in between them, partial top-ups included. Discarding partials would
  undercount fuel by ~20% on the demo fixture and report a flatteringly low figure that looks
  entirely reasonable.
- **A partial fill is never an endpoint even when it carries a reading.** That is the specific
  trap: the reading makes it look usable.
- **A backwards reading invalidates its own endpoint, not the series.** The interval stays open
  and closes at the *next* credible reading, because the mis-keyed value is a transposed digit
  and the following fill rejoins the true series. Two broken intervals would be the wrong answer.
- **The average is weighted by distance**, computed from summed litres over summed kilometres —
  not the mean of per-interval rates, which would weight a 40 km interval like a 900 km one.
- **Both fuel cost per km and total ownership cost per km** are shown, distinctly labelled. The
  gap between them is the insurance, tax, tyres and maintenance this project exists to surface.
- **Cost-per-km divides by the span of *usable* readings**, so one mis-keyed low value cannot
  become the series start and inflate the distance.
- **`formatEurPerKm` is added to `lib/money.ts`**, at three decimal places. Two decimals would
  collapse €0.128 and €0.13, and the division is a money conversion — putting it in the view
  would be the first crack in the one-converter rule. 03-01's boundary forbade touching
  `money.ts`; that was local to 03-01, and adding here upholds the standing rule rather than
  breaking it.
- **The intervals are listed in the UI**, not just the average. A summary figure alone is
  precisely the plausible wrong number nobody can check.

### Phase 4: PWA & Mobile UX

**Goal:** App installs on a phone home screen and adding an expense (with an optional photo) takes seconds.
**Depends on:** Phase 2 (needs the Expense flow to make it fast/installable)
**Research:** Unlikely (next-pwa and similar tooling are well-documented)

**Scope:**
- Installable PWA manifest/service worker
- Fast quick-add expense flow, responsive polish
- Car/expense photo upload (Attachments + Supabase Storage)

**Split into three plans at planning time (2026-08-10).** The scope bundles three genuinely
separate concerns — an install/offline shell, a UI flow, and a schema change against an
external storage service — and only the first has no blocker. PWA goes first because it
touches neither the schema nor any external account, so it can land while the Supabase
project for 04-03 is still being created.

**Settled at 04-01 planning time (2026-08-10):**

- **The service worker is hand-written**, a plain `public/sw.js`, per Next.js's own App
  Router guidance. Not `next-pwa` (unmaintained, pinned to older Next.js) and not Serwist
  (maintained, but a build-plugin dependency taken purely for convenience). Consistent with
  hand-rolled Tailwind and hand-rolled SVG charts, and it keeps the caching rule readable
  rather than configured.
- **⚠️ The cache policy is a security boundary, not a performance setting.** Every page in
  this app is behind a session and renders one user's rows, so a cached navigation response
  would outlive the session that authorised it and survive sign-out. The worker caches
  static assets only — never HTML, never `/api`, never a non-GET. Navigations are
  network-only with a static `/offline.html` fallback, and 04-01 proves it by going offline
  and asserting the user's data is **absent**, not merely that an offline page appears.
- **Two standing rules are spent deliberately, and only these two.** `public/sw.js` is the
  first plain-JS source file (a service worker is fetched as a static file and is not in the
  TypeScript build graph; the alternatives are a compile step or a script-in-a-string route
  handler, both worse), and the registration component is the first layout-level client
  boundary (there is no server-side way to register a worker). It renders `null`.
- **Icons are rasterised by the Chromium Playwright already installs**, via a tracked
  `scripts/generate-icons.ts`, from one hand-authored SVG. No image library for four files.
  The PNGs are committed — Vercel serves them statically and will not run the generator —
  and a unit test parses their IHDR headers so a manifest that outgrows its files fails in
  `npm test` rather than in a store review.
- **No offline writes.** No background sync, no queued mutations. Offline means the shell
  loads and says so honestly; anything more needs a conflict story this phase does not have.
- **04-03 needs a real Supabase project**, which the user has taken on. It blocks neither
  04-01 nor 04-02.

**⚠️ For 04-02:** the accessibility audit belongs there, not in 04-01 — 04-01 changes no UI
that a user reads. Contrast, focus order and keyboard navigation are still unverified
project-wide.

**Plans:**
- [x] 04-01: Installable PWA — manifest, generated icons, a hand-written service worker whose
      cache boundary is proven offline, and the `/offline.html` fallback
- [x] 04-02: Quick-add — one tap from the dashboard, a car-agnostic `/expenses/new`, and the
      project's first accessibility audit over that path
- [x] 04-03: `Attachment` schema, a storage interface with a local adapter, expense photo upload
      with browser-side downscaling, and ownership-checked serving
- [x] 04-04: Car photos on the same ownership terms as expense photos, plus a Supabase Storage
      adapter behind the existing interface

**Phase 4 completed 2026-08-10.** 4 plans, ~275 minutes, 170 tests added (581 total). The goal —
"the app installs on a phone home screen and adding an expense (with an optional photo) takes
seconds" — is met on every clause, and each claim is demonstrated rather than argued.

**⚠️ The through-line of this phase, in four plans: every single one contained something that was
believed, tested, and wrong until it was executed for real.** 04-01 rewrote two tests that passed
for the wrong reason. 04-02's planned accessibility control could not fire at all. 04-03's AC-4
fixture could not have failed, and replacing it exposed Next's silent 1 MB server-action body limit.
04-04's Supabase adapter passed its stub-based tests while mishandling every missing object, because
real Supabase reports not-found as HTTP 400 with the status in the body — which would have turned a
missing object into a 500 from the serving route. **None were caught by review. All were caught by
deliberately breaking things, by looking at output, or by running against the real service.**

**⚠️ Also found in 04-04, and worth carrying:** adding a `STORAGE_DRIVER` seam gave the test suites
a path into production storage, because `.env` reaches them through `dotenv/config`. Every
attachment test would have written real objects into a real bucket. Both paths now force
`STORAGE_DRIVER=local`, overwritten rather than defaulted — the same two-place fix 08-01 needed for
`DATABASE_URL`. **Adding a driver seam adds a way for tests to reach production; close it in the
same plan.**

**Still open after Phase 4:** no EXIF/GPS stripping on uploaded photos (the item with a privacy
dimension, and deployment is now possible); five routes unaudited for accessibility; no real
home-screen install performed; and the Supabase adapter is verified once, by hand — nothing in CI
exercises it, so an API change would surface in production.

**Found at 04-04 planning time, and it is the reason car photos are a correctness job rather than a
UI job:** every query in `lib/attachments.ts` scopes through `expense`, so an attachment whose
`expenseId` is null can match nothing. `/api/attachments/[id]` would return **404 for the owner's own
car photo**. 04-03's design only looks complete because car attachments do not exist yet. The filter
becomes an OR over both ownership paths — a new query shape, so each half gets mutation-tested
independently.

**Also settled at 04-04 planning time:**

- **`deletedAt: null` on both sides of the OR.** A soft-deleted car's photos must stop being served,
  exactly as its expenses do. The objects survive, because soft delete preserves history.
- **`db:seed:demo --clear` is the project's only hard delete of a car**, so it is the only path
  where the cascade orphans objects. It gets the same read-keys-then-delete treatment
  `deleteExpense` got in 04-03.
- **No `@supabase/supabase-js`.** Three REST calls (`put`/`get`/`delete` against
  `/storage/v1/object/{bucket}/{key}`) do not justify the project's first runtime dependency since
  Phase 2, and an SDK could not be verified any more easily than fetch can.
- **The resolver fails loudly when `STORAGE_DRIVER=supabase` and configuration is missing.** A
  silent fall back to local storage in production is precisely the failure that loses photos while
  appearing to work.
- **⚠️ The bucket must be PRIVATE.** A public Supabase bucket serves every object at a guessable URL
  with no session check, bypassing `/api/attachments/[id]` and undoing the whole ownership design.

**⚠️ Verified before planning: there is still no Supabase project, credentials, SDK or CLI.** The
adapter is therefore written and unit-tested against a stubbed transport, and real verification is a
**blocking checkpoint placed last**, after everything else is done and green. If the project does not
exist when it is reached, **AC-5 is recorded as unverified and carried forward** rather than quietly
claimed — the code ships, the claim does not.

**04-01 completed 2026-08-10.** ~47 minutes, 33 tests added (444 total). Installable with zero new
dependencies; the cache boundary is demonstrated by an offline navigation returning the user's data
**absent**, plus a direct read of Cache Storage showing no HTML key.

**⚠️ Found in 04-01, and the reason two tests were rewritten:** the obvious "never caches a
navigation" unit test passed with the guard deleted — `/` and `/cars/...` are refused by the
*allowlist*, so the navigation check was doing nothing. The AC-4 e2e test had the same weakness: it
loaded `/` once, before the worker controlled the page, so a worker that cached HTML *and* fell back
to `/offline.html` would have passed. Both now exercise what they claim. **This is the third time
mutation testing has overturned an assumption about which check is load-bearing** (03-01's pre-check,
03-03's redundant filters, now this) — for 04-02 and 04-03, budget for it rather than treating it as
optional polish.

**⚠️ Also found in 04-01:** every automated check passed on a broken icon that rendered as a small
glyph in the top-left corner. Only opening the PNG caught it. **Visual output needs looking at**, and
no assertion substitutes.

**⚠️ For 04-02 and 04-03:** the cache in `public/sw.js` is an allowlist and that is a security
property, not a performance setting — widening it is a security change and needs the AC-4 tests
re-run. `CACHE_VERSION` must be bumped by hand when the precache list changes; nothing enforces it.
The app now ships one client component in the shell (the worker registration, rendering `null`) —
that was the whole cost of installability and is not a precedent.

**⚠️ Still open from 04-01:** no real home-screen install has been performed. Every requirement
installability depends on is proven by test; the device install itself is not — the same shape of
gap as the Google login that stayed open from 02-04 until 09-01.

**Settled at 04-02 planning time (2026-08-10):**

- **Two entry points, because one does not cover both cases.** Dashboard car cards get "Add fuel" /
  "Add expense" (one tap, car already known — the common single-car case), and a new car-agnostic
  `/expenses/new` resolves the car itself: no picker at all with one car, a select defaulting to the
  newest with several, and a redirect to `/cars/new` with none. The car-agnostic route is what a
  home-screen shortcut or deep link can point at, which a per-card button cannot be.
- **The route takes no `carId` parameter.** Per-car adds already have `/cars/[id]/expenses/new`.
  Accepting an id here would raise the question of what to do with a foreign or stale one, and every
  answer — 404, silent fallback, error — is worse than not offering the parameter.
- **The default car is the most recently ADDED, not the most recently used.** `listActiveCars`
  already orders `createdAt: "desc"`, so this costs no new query. "Most recently used" is marginally
  better UX and would cost a new scoped query shape, which by the standing rule needs its own
  isolation test and its own mutation test — for a *default*. Deferred, not silently dropped.
- **`@axe-core/playwright`, gating on serious and critical only.** The first dependency taken purely
  for testing since Playwright, and justified: hand-computing contrast ratios and reasoning about
  accessible names is what a tool does reliably and a person does not. Moderate and minor findings
  are recorded, not gated — a gate that fails on an advisory gets switched off, and then nothing is
  gated at all.
- **Four pages audited, five explicitly not.** `/signin`, `/`, and both add forms, on both
  viewports. `/cars`, `/cars/new`, the edit pages, `/categories`, and the report and odometer pages
  are named in the docs as unaudited so the gap is visible rather than implied.
- **No persistent navigation in this plan.** The app has none today and every page hand-rolls its own
  back link — a real gap, but a nav shell touches all nine routes and would swamp both the quick-add
  work and the audit. Deferred, to be decided after the audit says what is actually broken.

**⚠️ For 04-02, and expected rather than a regression:** `tests/e2e/home.spec.ts`'s "links each car
card to that car's report" selects `getByRole("link").first()` inside the cars region. Adding card
actions makes `.first()` ambiguous, so that locator must become specific. Same shape as the `/`
placeholder assertion that 03-03 had to update.

**04-02 completed 2026-08-10.** ~85 minutes, 46 tests added (490 total). Adding a fuel expense went
from three taps to one; `/expenses/new` resolves the car itself and is reachable from the installed
app's shortcuts; and the project has an accessibility gate for the first time — zero serious and
zero critical across four pages on both viewports.

**⚠️ The most valuable finding in 04-02 was that its planned accessibility control could not fire.**
Stripping the amount label's `htmlFor` produced **no** axe violation, because `placeholder="45.20"`
satisfies the accessible-name computation. A real contrast regression is what proved the gate works.
A second check showed the HTML parser silently unnests `<a>` inside `<a>`, so `nested-interactive`
can never fire either. **Both blind spots are documented; the gate is a gate, not a WCAG AA
certification.** Also: the audit's own preconditions originally waited on `getByLabel`, so when
labels broke, the test failed on the wait and axe never ran — a control that looks like it works and
does not.

**⚠️ For 04-03 and every later UI plan:** add new pages to `tests/e2e/accessibility.spec.ts` — one
line each. Five routes remain unaudited (`/cars`, `/cars/new`, the edit pages, `/categories`, and
the report and odometer pages), and a new UI that skips the gate is the gap reopening rather than
merely not closing.

**Deferred out of 04-02:** "most recently used" as the default car (needs a new scoped query shape
and therefore its own isolation and mutation tests, to buy a preselected `<option>`), and a
persistent navigation — every page still hand-rolls its own back link. The audit surfaced no urgent
reason to revisit the latter.

**Split again at 04-03 planning time (2026-08-10) — the phase is now four plans.** Verified against
the working tree first: there is no Supabase project, no credentials, no SDK and no CLI. Rather than
stall a loop at a human-action checkpoint, 04-03 builds everything behind a **storage interface with
a local filesystem adapter** — fully testable today — and 04-04 adds the Supabase adapter, car
photos, and the deployment wiring once the project exists.

**Settled at 04-03 planning time:**

- **The browser downscales before upload, and that is not cosmetic.** A Vercel serverless request
  body is capped at **4.5 MB** and a phone photo is routinely 3–6 MB, so a plain server-action
  upload fails on exactly the files the feature exists for. A canvas resize to a 1600px longest edge
  puts a typical photo under 500 KB. The file still passes through the server, so size and MIME
  validation stay in one place — **server-side validation is the backstop; the browser is never
  trusted to have shrunk anything.**
- **Serving is an ownership-checked proxy route**, `/api/attachments/[id]`, not a signed URL. A
  leaked signed URL works for anyone until it expires, and isolation would have to be argued about
  URL minting instead of demonstrated by a request being refused. **404, never 403** — the existing
  rule that saying which would confirm the other exists. `/api/*` is already outside the service
  worker's cache allowlist, so no photo is ever cached; 04-03 confirms that rather than assuming it.
- **Objects live under a gitignored `.storage/`, never under `public/`.** Anything in `public/` is
  served statically with no session check, which would make every photo world-readable at a
  guessable path. Keys are `randomUUID` plus an extension from the *validated* MIME type, never the
  client's filename, and the key never leaves the server — the route takes the attachment id.
- **A CHECK constraint enforces exactly one of `carId`/`expenseId`.** Prisma cannot express it, so
  it is hand-written migration SQL, the same precedent as 02-03's partial unique indexes. Without
  it the dual-nullable-foreign-key decision is a comment rather than a rule.
- **`carId` lands in this migration** even though car photos are 04-04's — splitting one table
  across two migrations to defer a nullable column is worse than declaring it.
- **`deleteExpense` deletes the objects before the row.** The database cascade removes Attachment
  rows without the app ever learning their storage keys, which would orphan every object silently.
  This is the one edit to a file 04-02 protected, and AC-5 requires it.
- **One attachment per expense in the UI**; the schema permits many, but a gallery has its own
  design questions.

**⚠️ Deferred privacy issue from 04-03:** **no EXIF stripping.** A canvas re-encode drops EXIF as a
side effect — including GPS coordinates — but that is a consequence, not a guarantee, and the
no-canvas fallback path preserves it. Worth making explicit before any deployment carries real
photos.

**04-03 completed 2026-08-10.** ~75 minutes, 56 tests added (546 total). A photo attaches at the
moment the expense is recorded, shrinks in the browser first, and is readable by nobody else —
404 for another user and for no session at all.

**⚠️ The single most important finding: AC-4 was never actually tested, and hid a real defect.**
Every attachment test used the committed 192px icon as its fixture — already inside the 1600px
limit, so the downscaler took its "leave it alone" branch every time. Replacing it with a generated
4000×3000 image immediately exposed that **Next caps a server action's body at 1 MB by default**,
stricter than the 4.5 MB Vercel limit the whole design was built around. A 1137 KB upload was
rejected before the action ran, **with no error shown to the user at all**. There are now three
layered limits — browser downscale (1600px) → validation (2 MB, the readable one) → `bodySizeLimit`
(3 MB) — and changing the first means re-checking the last.

**⚠️ Two more assertions that proved nothing**, both found by looking at a screenshot rather than by
a test: `toBeVisible()` passed against a 320×2 image that had never loaded (it only needs a
non-empty box — poll `naturalWidth > 0`), and the `width`/`height` columns existed for the express
purpose of reserving the image's space while nothing ever wrote to them.

**Mutation results — the answers diverged again, for the fourth time.**
`getAttachmentForUser`'s ownership filter is load-bearing; `deleteAttachment`'s `deleteMany` filter
is **not** — the pre-check carries it. It stays as defence in depth and is documented as redundant
rather than implied to be proven.

**⚠️ For 04-04, which now closes the phase:**
- **The Supabase adapter is required, not optional.** Vercel's filesystem is ephemeral, so the local
  adapter works in development and would silently lose photos in production.
- **Car photos need no migration** — `Attachment.carId` and the CHECK constraint already exist.
- Prisma 7's `migrate diff` needs `SHADOW_DATABASE_URL` and has renamed flags (`--to-schema`, and
  no `--shadow-database-url`). `gaspense_shadow` exists on the local container now.

### Phase 5: Bulgarian Integrations

**Goal:** A user can check whether a car has outstanding fines or a valid vignette from within the app.
**Depends on:** Phase 2 (needs Car entities to check against)
**Research:** ✅ **Done 2026-08-11** — `.paul/phases/05-bulgarian-integrations/DISCOVERY.md`

**Scope:**
- Vignette validity per car, and КАТ/МВР fines per person, attributed to cars
- Both called server-side, with rate limiting

**Discovery outcome (2026-08-11).** Two endpoints supplied from browser network tabs, both called
live. The gate that has blocked this phase since ideation is closed.

- **Vignette** — `GET check.bgtoll.bg/check/vignette/plate/BG/{PLATE}`. No auth, ~120 ms, keyed by
  plate, **no personal data needed**.
- **Fines** — `GET e-uslugi.mvr.bg/api/Obligations/AND?…`. No auth, keyed by **ЕГН + driving
  licence**, returning two `unitGroup`s that must be merged.

**⚠️ Three findings that shape the plans more than the endpoints do:**

1. **Both services answer HTTP 200 for logical failures.** The vignette returns `ok:false` with an
   embedded `status.code: 500` for "no vignette", and returns *exactly that* for a malformed plate
   too. МВР returns a **429 KB HTML page** when throttled, so a naive `.json()` throws. **Parse the
   body, check the content type, never trust the status** — the same trap as 04-04's Supabase
   adapter, met twice in consecutive phases.
2. **Fines are per PERSON, not per car.** The original per-car framing was wrong: the request takes
   a person's identifiers and returns fines across all their vehicles, each carrying
   `additionalData.vehicleNumber` for attribution.
3. **The fine object's shape is from a third party's 2024 fixtures, not observed** — the verifying
   account has no fines. Field names are known; the currency is not, and Bulgaria adopted the euro
   in 2026.

**Decided 2026-08-11 (owner's call, after the alternative was recommended):** the ЕГН and driving
licence are **stored encrypted, opt-in** — AES-256-GCM, server-only key, nullable columns, write-only
in the UI, a working "forget" action, a key-version prefix, never logged. **⚠️ This protects a
database dump, not host compromise: the key lives beside the DB credentials and an ЕГН cannot be
rotated after a breach.** Full requirements pinned in DISCOVERY.md.

**Split into two plans at 05-01 planning time (2026-08-11).** The two halves share almost nothing:
the vignette needs no personal data, no encryption and no new trust boundary, while fines need all
three. Bundling them would hide which risk belongs to which feature — and Phase 4 demonstrated four
times that the plan carrying a *guarantee* costs more than the plan carrying a *feature*. The
vignette goes first because it delivers user-visible value with the smallest blast radius, and it
builds the two things fines will need anyway: a body-first client and a test seam.

**Settled at 05-01 planning time:**

- **`VignetteCheck` is a log, not columns on `Car`** — the same shape as `OdometerReading`. The
  latest row *is* the current state, and it also answers "when did we last look", which five
  denormalised columns would not.
- **`UNAVAILABLE` results are stored too**, so "we tried and could not reach it" is visible rather
  than looking like "never checked". The UI reads the latest *successful* check for the status and
  the latest row of any kind for "last tried".
- **⚠️ `none` and `unavailable` must never collapse.** Reporting "no vignette" because the service
  was down tells someone their vignette expired when it did not.
- **The cooldown IS the rate limit.** Derived from `checkedAt` on data already stored — no new
  table, no in-memory counter a serverless process cannot share, per car, and it survives a cold
  start. Six hours; a vignette's validity changes at most daily.
- **`VIGNETTE_DRIVER` defaults to `live`, the opposite of `STORAGE_DRIVER`'s safe default — on
  purpose.** A storage driver defaulting to local loses photos if misconfigured; a vignette client
  defaulting to stub would show *fabricated* vignette data in production, which is worse than an
  error. **The suites force the stub in two places** — Playwright workers and the server under test —
  which is 04-04's lesson applied before it can bite.
- **The country segment is hardcoded `BG`** and `Car` has no country field, so a foreign-plated car
  returns "no active Bulgarian vignette", which is literally true. Labelled that way in the UI rather
  than fixed with a schema change or a plate regex — both stand as decisions.
- **No `/api/vignette/check` route.** The roadmap sketched REST endpoints; the standing decision is
  that mutations are server actions and the app is its own only client. A route would be a second
  shape with no caller.
- **No scheduled checking.** Manual only — cadence remains a deferred issue and a background job
  needs a scheduler this project does not have.

**⚠️ Three high-impact unknowns carried into 05-02:** the currency of a fine `amount`, the МВР
rate-limit threshold and whether it is per-IP (serverless egress is shared), and whether МВР is
reachable from Vercel's egress at all — untestable from here, and it would invalidate the fines half.

**05-01 completed 2026-08-11.** ~55 minutes, 46 tests added (627 total). Each car's vignette status
sits on `/cars`, one tap from a refresh, and an unreachable service never reads as an expired
vignette — proven in the client, the data model, e2e, and by eye.

**Verified against the real service, and it corrected an invented fixture.** `npm run verify:vignette`
exercised both paths live, and the response showed that a real *exempt* vignette returns
`vignetteNumber: null` and a sentinel `validFrom` of 1980-01-01, where the unit test had made up a
plausible number and start date. The client handled both correctly, so nothing was broken — but the
test was asserting against fiction, which is precisely the state 04-04's adapter was in when its
stub-based tests passed while it was wrong.

**Mutation testing: a second consecutive clean sweep.** All four scope filters load-bearing — the
ownership pre-check on write, both relation filters on read, and `deletedAt` on the car. Six askings
across the project, six different answers.

**Two design points worth carrying:**
- **`<form action>` cannot return a value**, and honouring that produced a better answer than the
  plan had: the cooldown is computed server-side and the button is simply **not rendered** inside the
  window, rather than offered and refused. The action enforces the cooldown regardless, because
  hiding a button does not stop a form post being replayed.
- **A throwaway screenshot script made the feature look broken** — it navigated immediately after
  clicking and aborted the in-flight submit. The app was correct. Worth remembering that "looking"
  can also produce a false negative.

**⚠️ Still open from 05-01:** the endpoint is unofficial and only `npm run verify:vignette` would
reveal a change, since nothing in CI touches it; a **malformed plate is indistinguishable from a
plate with no vignette**, so a typo reads as "no vignette"; and a foreign-plated car reports "no
active Bulgarian vignette" — true, but easy to misread if the word "Bulgarian" is skimmed.

**Accessibility:** `/cars` audited in 05-01. Three routes remain — `/cars/new`, `/categories`, and
the report and odometer pages.

**Plans:**
- [x] 05-01: Vignette status per car — a body-first client, a stored check log, a cooldown that is
      the rate limit, and the test seam that keeps the suites off a government service
- [ ] 05-02: Fines — encrypted opt-in identifiers, the МВР client, a `Fine` entity attributed to
      cars by plate, and throttle handling

### Phase 6: Google Drive Export

**Goal:** A user can export their data to their own Google Drive on demand.
**Depends on:** Phase 2 (needs expense data to export)
**Research:** Unlikely (Google Drive API v3 + OAuth2 is well-documented)

**Scope:**
- Google Drive OAuth consent (reusing login provider)
- Export/backup of expense data to Drive

**Plans:**
- [ ] TBD — defined during `/paul:plan`

### Phase 7: Maintenance Reminders

**Goal:** A user can see, per car, how close each service item is to being due — and what is
already overdue — without doing arithmetic themselves.
**Depends on:** Phase 2 (needs cars and odometer readings to measure against)
**Research:** Unlikely (the logic is arithmetic over readings; no external service involved)

**Scope:**
- A new entity for a per-car service interval: what the item is, its interval in kilometres
  and/or months, and when it was last done (at which odometer reading and date)
- Due calculation against the latest odometer reading and today's date, whichever comes first
- A progress indicator per item: green, amber as it approaches due, red once overdue

**Requested during 02-06 review**, with worked examples: engine oil every 10,000 km;
transmission oil every 50,000 km or 3 years — so an interval must support distance, time, or
both, with whichever falls first winning.

**Open questions for `/paul:plan`:**
- Are intervals seeded as common defaults, or entered per car by the user?
- What distance or time before due should turn the indicator amber?
- Does marking an item done create an odometer reading, or just reference the latest one?

**Note on ordering:** placed after the existing phases so numbering stays stable, not because
it matters least. It depends only on Phase 2, so it can be pulled earlier on request.

**Plans:**
- [ ] TBD — defined during `/paul:plan`

### Phase 8: Test Environment Safety

**Goal:** Running the integration suite cannot destroy data that matters — neither a real
deployment nor the local database being used for development.
**Depends on:** Phase 2 (the suite and the tables it truncates must exist). Nothing later
depends on it.
**Research:** Unlikely (a connection-string precondition and a second database)

**Scope:**
- A precondition on the reset path that refuses to truncate a database not demonstrably a test database
- A dedicated test database, separate from the development one, wired through its own variable
- A decision on which database the e2e suite runs against
- `.env.example`, `CLAUDE.md`, and `AGENTS.md` updated to describe the split
- Tests proving the guard actually refuses — a safety check nobody has watched fail is not a safety check

**Found during review (2026-08-08), against the code as it stands:**
- `resetDatabase()` in `tests/integration/helpers.ts` issues `TRUNCATE ... CASCADE` over
  `Expense`, `OdometerReading`, `Car`, `Category`, `User` with **no assertion about which
  database it is connected to**. It truncates whatever `DATABASE_URL` resolves to.
- Development, integration, and e2e all share one database (`gaspense_dev`) —
  `playwright.config.ts` passes the same `DATABASE_URL` to the server under test. Running the
  integration suite already wipes local development data today.
- `tests/integration/setup.ts` depends on dotenv **not** overriding an already-set variable,
  which is exactly what makes CI work. The flip side: an exported shell `DATABASE_URL` silently
  beats `.env`, so the file that looks like it pins the connection does not.
- `.env.example` documents pointing `DATABASE_URL` at the Supabase **direct** connection to run
  migrations — precisely the shell state in which running the suite would truncate production.
- CI already satisfies a host-plus-name guard (`localhost:5432/gaspense_test`), so the workflow
  should need no change. Verify that rather than assuming it.

**Ruled out at review time:** per-test transaction rollback, the usual way to avoid TRUNCATE
altogether. `lib/expenses.ts` opens its own interactive `prisma.$transaction`, so an outer
rollback wrapper would mean threading a transaction client through production signatures for
the tests' benefit.

**Note on ordering:** placed last so numbering stays stable. There is no deployment yet, so
nothing real is at risk today — but the exposure becomes real the moment one exists. Pull this
before the first deploy, not after.

**Pulled forward ahead of Phase 4 (2026-08-10).** The exposure stopped being theoretical:
running the integration suite wiped the signed-in Google account twice in one session, each
time costing a re-login and a re-seed. Phase 4 means far more time in the running app.

**Split into two plans at planning time (2026-08-10).** The phase bundles two separable
concerns — *aim the suites somewhere safe* and *refuse to fire when aimed somewhere unsafe* —
and each half leaves the repository green on its own. The order matters and is not
interchangeable: shipping the guard first would refuse `gaspense_dev` and leave the suite
unrunnable until the second plan landed. 08-01 also delivers the relief that was actually felt.

**Settled at 08-01 planning time — the three open questions, answered:**

- **The guard is host-and-name, derived from the URL; no opt-in variable.** An
  `ALLOW_DESTRUCTIVE_TESTS`-style flag is set once in `.env` and forgotten, so it stays true
  when the shell later points at production — it decouples the permission from the target,
  which is the one thing the guard must not do. Deriving safety from the connection string
  keeps the permission attached to the thing that determines the danger. (08-02 implements it.)
- **e2e shares the test database with integration**, as it shares `gaspense_dev` today. e2e
  never calls `resetDatabase()` — it creates randomly-named users and deletes them — so it is
  not the destructive actor, and a third database would mean a third migration target for no
  isolation gain. The `ensureSystemCategories()` reasoning stays valid unchanged.
- **`npm run db:test:setup` creates and migrates on demand, idempotently**, rather than
  failing loudly with instructions. A `/docker-entrypoint-initdb.d/` script was rejected: it
  runs only against a fresh volume, so on the existing one it would do nothing while reading
  like it worked, and forcing it to take effect means `docker compose down -v` — wiping the
  development data this phase exists to protect.

**Also settled:** the suites read `TEST_DATABASE_URL`, **falling back to `DATABASE_URL`** when
it is unset. The fallback is what lets CI pass with no workflow edit, and 08-02's guard is what
makes the fallback safe — a fallback onto a production `DATABASE_URL` is refused on host and
name. `tests/integration/setup.ts` *overwrites* `process.env.DATABASE_URL` with the resolved
value, so the original is unreachable for the rest of the run rather than merely unused.

**Plans:**
- [x] 08-01: A dedicated test database, and every suite pointed at it — resolver,
      `db:test:setup`, Playwright wiring, docs, and proof via `current_database()` that the
      connection is where it is believed to be
- [x] 08-02: The guard — `resetDatabase()` refuses a database not demonstrably a test
      database, with tests proving the refusal actually fires

**Completed 2026-08-10.** Two plans, ~50 minutes, 27 tests added (411 total). The phase goal —
"running the integration suite cannot destroy data that matters, neither a real deployment nor the
local development database" — is met, and demonstrated rather than argued: the old
misconfiguration now exits non-zero naming the database, with `gaspense_dev` byte-identical
afterwards.

**Found in 08-02, and the reason the guard sits at two call sites:** guarding only the destructive
truncate stopped the data loss but still permitted *pollution* — specs wrote rows into
`gaspense_dev` before ever reaching the refusal. `createTestClient()` is guarded too, which moves
the failure to module scope where a spec cannot load at all against the wrong database. This was
found by running the misconfiguration on purpose, not by review.

**⚠️ For any future phase adding a destructive test path:** the guard covers `resetDatabase` and
`createTestClient`. The e2e helpers are deliberately unguarded — they never truncate and delete
only rows they created — as is `db:seed:demo --clear`, which is pinned to the `DEMO-0001` marker.
A new mass-destruction path would need its own `assertTestDatabase` call.

**⚠️ CI's connection string is pinned verbatim in `tests/unit/test-database.test.ts`.** Changing
`DATABASE_URL` in `.github/workflows/ci.yml` without re-checking the guard breaks a unit test
rather than breaking CI. If CI ever moves off a localhost service container, the host rule needs
revisiting — a legitimately remote test database is refused today, deliberately.

### Phase 9: Demo Data Seed

**Goal:** One command populates a realistic twelve-month history against the signed-in
developer's own account, so no screen has to be hand-built before it can be looked at.
**Depends on:** Phase 2 (needs Car, Expense, Category, OdometerReading to write).
**Research:** Unlikely (a script over the existing data layer).

**Requested 2026-08-09**, after 03-01: hand-creating a car and a dozen expenses to eyeball a
report is enough friction to stop the checking happening at all.

**Pulled ahead of 03-02 deliberately.** The seed's consecutive full-tank fill-ups with odometer
readings — including the awkward cases — are precisely the fixture 03-02 needs to develop
litres-per-100km against. Building the seed after 03-02 would mean hand-building that series
once for development and again for the seed.

**Scope:**

- `lib/seed-demo.ts` — the data builder, importable by tests without running a script. Mirrors
  the `lib/seed-categories.ts` split that keeps `prisma/seed.ts` a thin runner.
- A runner under `tsx` plus an `npm run db:seed:demo` script, taking `--email`.
- **Attaches to an existing user, found by email.** Fails loudly with an instruction to sign in
  with Google first if the address is unknown.
- Roughly twelve months against one car: ~28 fuel fills of which most are full-tank with an
  odometer reading, ~19 other expenses across the seeded categories.
- **Deliberate edge cases, not a clean series** — at least one partial fill, at least one fill
  with no odometer reading, and at least one non-increasing reading. A tidy dataset would hide
  exactly the bugs 03-02 has to survive.
- A way to remove the seeded data again, scoped so it can only ever touch the demo car.
- Tests: unit on the builder's shape and edge cases, integration proving it attaches to the
  right user, is safe to re-run, and cannot write to or delete another user's rows.

**Decided at request time (2026-08-09):**

- **Attach by email after first login**, rather than seeding a `User` row up front. Seeding the
  user first breaks sign-in: with the Prisma adapter, Google OAuth against an existing user that
  has no linked `Account` row is refused with `OAuthAccountNotLinked`. Attaching afterwards keeps
  the seed entirely out of the auth path.
- **One car, twelve months, built for 03-02 and 03-03** rather than a minimal populate-the-screen
  fixture.
- **The integration-suite clash is accepted, not solved here.** `resetDatabase()` truncates
  `User`, `Car`, `Expense` and `Category`, so running `npm run test:integration` wipes the demo
  data and it must be re-seeded. That is Phase 8's problem to fix properly; duplicating a
  partial fix here would mean two guards to keep honest.

**⚠️ Public repo:** placeholder data only — `DEMO-0001`-style plates, no real addresses, no real
amounts from anyone's actual records. The `--email` is supplied at runtime and must never be
committed or defaulted to a real address in tracked files.

**Settled at planning time (2026-08-09) — the open questions above, answered:**

- **Re-running replaces the demo car silently**, scoped strictly to the `DEMO-0001` marker. The
  common case is re-seeding after an integration run has wiped everything, where there is
  nothing to replace and a `--force` flag would be pure friction.
- **Dates anchor to today by default, with `--anchor YYYY-MM-DD` to pin them.** Dev runs always
  populate the current month; tests pin the anchor and assert hand-computed totals.
- **Clearing hard-deletes the demo car**, cascading to its expenses and readings — a deliberate
  exception to the soft-delete-cars rule, which exists to protect real history. Undoing a seed
  is not deletion of history.
- **The seed writes through `lib/expenses.ts` and friends**, not raw `createMany`. Slower, but
  the odometer↔expense linking stays in the one audited place instead of being duplicated, and
  a regression in the real write path breaks the seed loudly.

**Plans:**
- [x] 09-01: The demo dataset as a pure deterministic function, attached to a user by email
      through the real data layer, with a runner, docs, and proof it renders

**Completed 2026-08-09.** ~20 minutes, 40 tests added. `npm run db:seed:demo -- --email <address>`
produces 47 expenses and 30 odometer readings across twelve months.

**⚠️ For 03-02:** the fixture is deliberately awkward and its irregularity positions are exported
constants — `PARTIAL_FILL_INDEX`, `MISSING_READING_INDEX`, `DECREASING_READING_INDEX` in
`lib/demo-data.ts`. Reference them rather than rediscovering them. The decreasing reading is a
transposed digit, not a replaced odometer, so the following fill returns to the true series —
the harder case for a consumption calculation.

**Found during 09-01:** `Math.round(x / 100)` had made every fill a whole number of litres.
Nothing failed; the data was merely subtly unrealistic, and every consumption figure in 03-02
would have inherited that imprecision. Fixed, with a €/L ratio-band test that catches a scaling
error in either field.

---
*Roadmap created: 2026-08-07*
*Last updated: 2026-08-11 — 05-01 (vignette) complete; 05-02 (fines) remains*
