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
Phases: 3 of 10 complete (30%) — Phase 3 in progress; **Phase 9 pulled to run next**

## Phases

**Phase Numbering:** Integer phases only for now (0–9). Decimal phases (e.g. 2.1) reserved for
urgent insertions later.

**Numbering is not execution order.** Phases 7, 8 and 9 are all numbered after the existing work
so numbering stays stable, not because they matter least — each depends only on Phase 2 and can
be pulled forward. Phase 9 has been pulled to run **next**, ahead of the rest of Phase 3.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 0 | AI-Friendly Project Scaffolding | 2/2 | ✅ Complete | 2026-08-07 |
| 1 | CI/CD Pipeline | 1/1 | ✅ Complete | 2026-08-07 |
| 2 | Foundations | 7/7 | ✅ Complete | 2026-08-08 |
| 3 | Reporting | 1/3 | 🔵 In progress | - |
| 4 | PWA & Mobile UX | TBD | Not started | - |
| 5 | Bulgarian Integrations | TBD | Not started | - |
| 6 | Google Drive Export | TBD | Not started | - |
| 7 | Maintenance Reminders | TBD | Not started | - |
| 8 | Test Environment Safety | TBD | Not started | - |
| 9 | Demo Data Seed | TBD | ⏭️ Next | - |

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
- [ ] 03-02: Fuel efficiency — litres per 100 km from full-tank pairs, and cost-per-km;
      must survive gaps, partial fills, and a non-ascending odometer series
- [ ] 03-03: Dashboard — `/` becomes the dashboard with charts and the fleet roll-up;
      updates `tests/e2e/home.spec.ts`. The chart approach (library vs hand-rolled SVG)
      is decided at that plan, not before — no dependency is added in 03-01 or 03-02.

### Phase 4: PWA & Mobile UX

**Goal:** App installs on a phone home screen and adding an expense (with an optional photo) takes seconds.
**Depends on:** Phase 2 (needs the Expense flow to make it fast/installable)
**Research:** Unlikely (next-pwa and similar tooling are well-documented)

**Scope:**
- Installable PWA manifest/service worker
- Fast quick-add expense flow, responsive polish
- Car/expense photo upload (Attachments + Supabase Storage)

**Plans:**
- [ ] TBD — defined during `/paul:plan`

### Phase 5: Bulgarian Integrations

**Goal:** A user can check whether a car has outstanding fines or a valid vignette from within the app.
**Depends on:** Phase 2 (needs Car entities to check against)
**Research:** Likely — no confirmed public API exists yet for either the fines lookup or the vignette check
**Research topics:** Actual callable endpoint/mechanism, required identifiers, auth, and rate-limit behavior for both the КАТ/МВР fines lookup and the vignette validity check. Run `/paul:discover` before implementation.

**Scope:**
- Research spike to confirm callable mechanisms
- `/api/fines/check` and `/api/vignette/check` with rate limiting

**Plans:**
- [ ] TBD — defined during `/paul:plan`

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

**Open questions for `/paul:plan`:**
- Is the guard host-and-name based, an explicit opt-in variable, or both?
- Does e2e get its own database or share the integration one? They share today, and CI runs
  integration immediately before e2e.
- Does `npm run test:integration` create and migrate the test database on demand, or fail
  loudly when it is absent?

**Note on ordering:** placed last so numbering stays stable. There is no deployment yet, so
nothing real is at risk today — but the exposure becomes real the moment one exists. Pull this
before the first deploy, not after.

**Plans:**
- [ ] TBD — defined during `/paul:plan`

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

**Open questions for `/paul:plan`:**

- Re-running the seed: replace the existing demo car's data, or refuse unless `--force`?
- Are dates anchored to today (so "this month" always has data, but output is non-deterministic)
  or to a pinned anchor date that tests can assert against — or today by default with an
  `--anchor` override?
- Does removal delete the demo car outright, or soft-delete it like any other car?

**Plans:**
- [ ] TBD — defined during `/paul:plan`

---
*Roadmap created: 2026-08-07*
*Last updated: 2026-08-09*
