---
description: "Track the true, itemized cost of owning a car — fuel, maintenance, taxes, fines, vignette — with real month/year reporting instead of scattered receipts"
type: Project
about: "gaspense"
---

# Gaspense

## What This Is

A mobile-first PWA for tracking personal vehicle expenses — fuel, maintenance, taxes, body work, fines, and vignette validity — with real cost reporting (monthly/yearly, by category, cost-per-km) and Google Drive export. Built for personal use and shared with trusted friends/family, each with their own account; not for sale.

## Core Value

Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 0.0.0 |
| Status | Prototype — **Phases 0-4, 8 and 9 complete.** Log in, add a car, record expenses and mileage, and see what it all costs: by month, by year, by category, per kilometre, and litres per 100 km — with a dashboard on opening the app. It installs to a phone home screen, logging a fill-up is one tap, a photo can be attached to any car or expense, and it says so honestly when the network is gone. The test suites run against a database and an object store of their own, and refuse to touch any other |
| Last Updated | 2026-08-10 |

**Production URLs:** none yet.

## Requirements

### Core Features

- Track vehicle expenses (fuel, maintenance, taxes, body work, and other categories) per car
- View cost reports by month/year and by category, plus cost-per-km
- Mobile-first installable PWA with a fast "quick add expense" flow
- Check Bulgarian traffic police (КАТ/МВР) fines and vignette validity per car
- Export/backup data to Google Drive
- Attach photos to cars and expenses
- Record an odometer reading alongside a fuel fill-up, not only as a separate log
- Track fuel consumption as litres per 100 km
- Track maintenance intervals per car (e.g. engine oil every 10,000 km; transmission oil
  every 50,000 km or 3 years) and show how close each is to due, as a progress indicator
  that reads green, amber when near, and red when overdue

### Validated (Shipped)
- ✓ Agent-readable project context — `CLAUDE.md`, `AGENTS.md`, `docs/ARCHITECTURE.md` — Phase 0
- ✓ Public-repo secret protection — `.gitignore` verified against a real `.env`, `node_modules`, and `.key` files — Phase 0
- ✓ Lint/format toolchain — ESLint (typescript-eslint base), Prettier, EditorConfig, markdownlint — Phase 0
- ✓ `npm run check` — single CI-callable gate for docs presence + formatting + lint, proven to fail by name on a missing doc — Phase 0
- ✓ CI pipeline — GitHub Actions running `npm ci` + `npm run check` on pushes to `main` and PRs, proven to both pass and fail — Phase 1
- ✓ Pre-push hook — version-controlled in `.githooks/`, self-installing via `npm install`, aborts a real push when the gate fails — Phase 1
- ✓ Secret scanning + push protection verified active on the public repo — Phase 1
- ✓ Next.js 16 App Router app shell, building and serving, build-gated in CI — Phase 2 (02-01)
- ✓ Test infrastructure — Vitest + Playwright (desktop and mobile), both proven failable — Phase 2 (02-02)
- ✓ Data layer — Prisma 7 schema (5 entities), committed migrations, idempotent seed, 8 integration tests green in CI — Phase 2 (02-03)
- ✓ Authentication — NextAuth v5 + Google OAuth, database sessions, and per-user isolation proven by test — Phase 2 (02-04)
- ✓ Car CRUD — server actions over a scoped data layer, soft delete preserving expense history, mobile-first UI, 79 tests — Phase 2 (02-05)
- ✓ Expense CRUD — scoped through car ownership, separate fuel and other entry points, and a single audited euro↔cent helper — Phase 2 (02-06)
- ✓ Category CRUD — user-owned rows only; the seeded system defaults are shared and provably immutable — Phase 2 (02-07)
- ✓ Odometer log — per car, plus capture at fill-up time linked to the expense that produced it — Phase 2 (02-07)
- ✓ **Phase 2 complete** — 7 plans, 227 tests (85 unit, 89 integration, 53 e2e), every entity's cross-user isolation proven by test
- ✓ Per-car cost reporting — all-time, yearly, monthly and by-category totals at `/cars/[id]/report`, over a database-free aggregation module — Phase 3 (03-01)
- ✓ Real Google OAuth login performed and verified against a live provider, closing a concern open since 02-04 — Phase 9 (09-01)
- ✓ **Phase 9 complete** — `npm run db:seed:demo` attaches twelve months of deterministic demo history to a signed-in account in about a second, carrying the odometer edge cases fuel reporting must survive
- ✓ Fuel efficiency — litres per 100 km from full-to-full intervals, plus fuel and total cost per kilometre, over a series with gaps, partial fills and a reading that goes backwards — Phase 3 (03-02)
- ✓ Dashboard — `/` shows the fleet total, a twelve-month spend chart in server-rendered SVG, and a card per car; zero client JavaScript — Phase 3 (03-03)
- ✓ **Phase 3 complete** — 3 plans, 116 tests added, 384 total. The phase goal is exceeded: month/year and category costs were the target; cost-per-km, litres per 100 km and the dashboard shipped too
- ✓ Dedicated test database — `npm run db:test:setup`, one resolver shared by Vitest and Playwright, and proof via `current_database()` that the connection is where it is believed to be — Phase 8 (08-01)
- ✓ Destructive-operation guard — `resetDatabase` and `createTestClient` refuse any database that is not both local and `_test`-named, mutation-tested so both halves are proven load-bearing — Phase 8 (08-02)
- ✓ **Phase 8 complete** — 2 plans, ~50 minutes, 27 tests added (411 total). Running the suites can no longer destroy the development database or a real one; both claims are demonstrated, not argued
- ✓ Installable PWA — manifest, generated maskable icons, a hand-written service worker, and an offline fallback, with zero new dependencies — Phase 4 (04-01)
- ✓ Service-worker cache boundary — static assets only; an offline navigation returns the user's data **absent**, and Cache Storage provably holds no HTML key — Phase 4 (04-01)
- ✓ One-tap expense entry — dashboard card actions plus a car-agnostic `/expenses/new` reachable from the installed app's shortcuts; three taps became one — Phase 4 (04-02)
- ✓ First accessibility gate — axe-core over WCAG 2 A/AA on four pages and two viewports, zero serious or critical, with the gate's two blind spots measured rather than assumed — Phase 4 (04-02)
- ✓ Expense photo attachments — `Attachment` with a CHECK constraint, browser-side downscaling, and serving that returns 404 to everyone but the owner — Phase 4 (04-03)
- ✓ Car photos and a verified Supabase Storage adapter — ownership covering both owners with every branch mutation-proven, and the adapter run against a real private bucket — Phase 4 (04-04)
- ✓ **Phase 4 complete** — 4 plans, ~275 minutes, 170 tests added (581 total). The app installs to a phone, logging a fill-up costs one tap instead of three, four pages are gated against WCAG A/AA, and photos attach to cars and expenses with storage that can actually be deployed

### Active (In Progress)
- Nothing in progress — Phase 4 closed 2026-08-10. **Phase 5 (Bulgarian Integrations) is next, and
  is gated on a `/paul:discover` research spike**: no confirmed public API exists for either the
  КАТ/МВР fines lookup or the vignette check

### Planned (Next)
- Phase 5: Bulgarian Integrations — research spike, then fines/vignette checks (**research-gated**)
- Phase 6: Google Drive Export — OAuth consent, export/backup
- Phase 7: Maintenance Reminders — service intervals per car with due/overdue indicators

### Out of Scope
- Multi-currency support — EUR only, by explicit decision
- Shared/household accounts — each person has a separate account and dataset
- Public/multi-tenant SaaS features — this is a personal tool, not a product
- Real-time dashboards/live updates — not needed for a personal logging app
- Branch protection / required status checks — would block the authorised direct-to-`main` workflow; the local pre-push hook covers the gap instead
- Non-provider secret-scanning patterns — not offered for a personal-account public repo; requires GitHub's paid Secret Protection tier

## Target Users

**Primary:** The builder and a small circle of trusted friends/family
- Each has their own account and sees only their own cars/expenses
- Wants accurate, low-friction expense logging and real cost reporting
- Primarily uses the app on mobile

**Secondary:** None — this is not a public product.

## Context

**Business Context:**
Personal/hobby project, explicitly not for sale or monetized. Repository is public on GitHub (github.com/dnmitev/gaspense) — nothing sensitive is ever committed.

**Technical Context:**
Greenfield build. No existing systems to integrate against beyond Google OAuth/Drive (well-documented) and the Bulgarian traffic police fines/vignette services (undocumented — research spike required before Phase 5).

## Constraints

### Technical Constraints
- Stack fixed: Next.js (TypeScript) + Supabase (Postgres + Storage) + Vercel
- Auth: Google OAuth only (NextAuth)
- No confirmed public API yet for the Bulgarian fines/vignette checks — Phase 5 blocked on a `/paul:discover` research spike
- EUR only — no multi-currency logic

### Business Constraints
- Public repo — nothing sensitive (secrets, personal data, real license plates) may ever be committed
- Free/near-free tooling only — cloud free tiers, open-source where possible
- Solo maintainer — direct commits to `main` are explicitly authorized (no PR-per-change requirement)

### Compliance Constraints
- None formal, but personal data (photos, expense records) must stay out of the public repo entirely (env vars, real DB only — never fixtures/seed data)

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| PostgreSQL over MongoDB | Data is inherently relational (cars → expenses → categories, fines/vignette per car) | 2026-08-07 | Active |
| Supabase for both DB and Storage | One provider, one free tier, S3-compatible storage for car/expense photos | 2026-08-07 | Active |
| Google OAuth for auth | No password management; reuses the Google Drive consent flow | 2026-08-07 | Active |
| Separate accounts per person | Real per-user data isolation, not shared household login | 2026-08-07 | Active |
| EUR only, no multi-currency | Simplifies all reporting and storage | 2026-08-07 | Active |
| Odometer as a first-class log | Independent of expenses, for accurate efficiency calculations | 2026-08-07 | Active |
| Attachments via nullable dual foreign keys (carId/expenseId) | Simplest shape to support photos on both cars and expenses | 2026-08-07 | Active |
| Bulgarian integrations deferred to Phase 5 with research spike | No confirmed public API exists yet for fines/vignette checks | 2026-08-07 | Active |
| AI-friendly scaffolding as Phase 0 | Full project context before any feature code | 2026-08-07 | Active |
| CI/CD as Phase 1, before Foundations | Every later phase is automatically checked from the start | 2026-08-07 | Active |
| Direct commits to `main` | Explicitly authorized for this low-risk personal project | 2026-08-07 | Active |
| Public repo, no sensitive data ever committed | Real credentials live only in environment variables | 2026-08-07 | Active |
| `.gitignore` scopes `.claude/` to `worktrees/` only | `.claude/settings.json` is deliberately tracked; ignoring `.claude/` wholesale would untrack a committed file | 2026-08-07 | Active |
| CLAUDE.md and AGENTS.md are always edited together | Two files carrying one set of facts diverge silently if edited separately | 2026-08-07 | Active |
| npm as package manager | Already installed, Vercel's default, simplest CI caching | 2026-08-07 | Active |
| typescript-eslint base in Phase 0; `eslint-config-next` in Phase 2 | Lint rules must exist before the first application code is written | 2026-08-07 | Active |
| Prettier is formatter of record; markdownlint owns structure | Overlap tested empirically — only MD013 genuinely conflicts | 2026-08-07 | Active |
| No `test` script until Phase 2 | A no-op passing test script would give CI a false green | 2026-08-07 | Active |
| `license: UNLICENSED` + `private: true` | Avoids npm's default ISC grant on a public repo; real licence choice still open | 2026-08-07 | Active |
| CI triggers on `push` to `main`, not PR-only | This project commits directly to `main`; a PR-only workflow would never fire | 2026-08-07 | Active |
| Node 22 floor (raised from 20) | Node 20 reached EOL 2026-04-30; CI must not validate an unsupported runtime | 2026-08-07 | Active |
| No branch protection | Required checks would block the authorised direct-push flow; the pre-push hook is the pre-landing gate | 2026-08-07 | Active |
| Git hooks tracked in `.githooks/`, activated by `prepare` | `.git/hooks/` is not version-controlled; a fresh clone must need no manual setup | 2026-08-07 | Active |
| Vitest + Playwright for unit/integration and e2e | Modern default for Next.js; both proven able to fail before being trusted | 2026-08-07 | Active |
| e2e serves the production build, never `next dev` | `next dev` regenerates the AGENTS.md agent-rules block, dirtying the tree every test run | 2026-08-07 | Active |
| Vitest runs `globals: false` | Explicit typed imports; requires manual `afterEach(cleanup)` or the DOM leaks between tests | 2026-08-07 | Active |
| Unit tests DB-free; integration a separate project | The fast feedback loop must not depend on a running container | 2026-08-07 | Active |
| Local Docker Postgres (host port 5433) + CI service container | No Supabase account or secrets needed; 5432 is held by another project on this machine | 2026-08-07 | Active |
| Prisma 7 with the `@prisma/adapter-pg` driver adapter | Prisma 7 makes an adapter mandatory; it also accepts a `pg.Pool`, the serverless-pooling lever | 2026-08-07 | Active |
| Connection URLs in `prisma.config.ts`, not the schema | Prisma 7 removed `url`/`directUrl` from the datasource block | 2026-08-07 | Active |
| Money as `amountCents Int`; `liters` as Float | Prisma `Decimal` returns Decimal.js, breaking the Next server-to-client boundary; integer cents gives exact arithmetic and trivial SUM() | 2026-08-07 | Active |
| `pricePerLiter` derived, not stored | A stored derived value can drift from its inputs | 2026-08-07 | Active |
| Schema limited to Phase 2's five entities | Fine/Vignette shapes depend on the unresolved Phase 5 research; Attachment waits for Phase 4 | 2026-08-07 | Active |
| Category uniqueness via raw-SQL partial indexes | Prisma cannot express them, and `@@unique([userId, name])` is defeated by Postgres treating NULLs as distinct | 2026-08-07 | Active |
| Prisma seed/scripts run under `tsx` | The generated client uses bundler-style extensionless imports Node's ESM loader cannot resolve | 2026-08-07 | Active |
| Generated Prisma client to `lib/generated/prisma` | Prisma 7 defaults to `app/generated/prisma`, inside the App Router tree | 2026-08-07 | Active |
| Reject `prisma init`'s agent-skill injection | Writes 71 files to `.agents/`, `.claude/skills/`, `.windsurf/` and edits `.gitignore`; verified non-regenerating | 2026-08-07 | Active |
| `requireUserId()` throws rather than returning null | Prisma reads `undefined` in a `where` clause as "no filter", so a nullable helper would silently query every user's rows | 2026-08-07 | Active |
| Database sessions over JWT | Revocable, and the adapter persists `Account.refresh_token` that Phase 6's Drive export needs | 2026-08-07 | Active |
| Omit the WebAuthn `Authenticator` model | The adapter only touches it in WebAuthn methods, unreachable with Google-only sign-in | 2026-08-07 | Active |
| Per-page auth checks, not middleware | Next 16 middleware plus NextAuth beta adds moving parts for no gain; per-page checks are testable | 2026-08-07 | Active |
| No Google Drive scopes until Phase 6 | Keeps the consent screen honest about what the app currently does | 2026-08-07 | Active |
| Mutations are server actions, not REST routes | The app is its own only client; the nine documented REST groups were a design sketch never built | 2026-08-07 | Active |
| Hand-rolled Tailwind, no component library | A list and a form need no library; adopt shadcn when a dialog or date picker earns it | 2026-08-07 | Active |
| Data-layer functions take `userId` explicitly | Scoping is visible at the call site and the functions stay unit-testable without mocking auth | 2026-08-07 | Active |
| Writes use scoped `updateMany`, never findUnique-then-update | Puts `userId` in the same WHERE clause as the id, so a wrong owner affects zero rows | 2026-08-07 | Active |
| No licence-plate format regex | The owner may register a car in any country; a guessed pattern would reject valid input | 2026-08-07 | Active |
| `AUTH_URL` required for production builds | Auth.js rejects every session read with UntrustedHost otherwise; narrower than `trustHost: true` | 2026-08-07 | Active |
| `lib/money.ts` is the only euro↔cent converter | A missed ÷100 is a 100× error that produces a plausible number and crashes nothing | 2026-08-08 | Active |
| Amount input is `type="text" inputMode="decimal"` | `type="number"` lets the browser's locale rules reject or reformat "12,34" before the schema sees it | 2026-08-08 | Active |
| Fuel and other expenses have separate entry points | One form carrying every field is cluttered for the common case; only field VISIBILITY branches, never validation | 2026-08-08 | Active |
| The form may match the seeded Fuel category by name | It matches system rows only (`userId: null`), which no user can rename; user categories stay off-limits to name matching | 2026-08-08 | Active |
| e2e suites seed their own categories | System categories are global rows; the integration suite truncates them and CI runs it first | 2026-08-08 | Active |
| `OdometerReading.expenseId` — nullable, unique, cascade | `source: EXPENSE` alone cannot maintain the pair; matching on (carId, date) is ambiguous and a stale reading would corrupt the consumption series | 2026-08-08 | Active |
| Database constraints Prisma cannot type are described results, not exceptions | Duplicate names (P2002) and in-use categories (P2003) are ordinary user actions and must not surface as crashes | 2026-08-08 | Active |
| Category deletion is refused with a count, never reassigned | Silently moving someone's records while they asked to delete a label exceeds the request | 2026-08-08 | Active |
| System rows protected by ordinary scoping, with no special case | `where: { id, userId }` cannot match a NULL userId; a special case would imply the general rule needs supervision | 2026-08-08 | Active |
| Odometer readings are not required to increase | Odometers get replaced, corrected, and roll over; Phase 3 must cope with an out-of-order series instead | 2026-08-08 | Active |
| Migrations generated with `migrate diff`, proven with `migrate deploy` | `migrate dev` refuses headless and Prisma 7 blocks `migrate reset` under Claude Code | 2026-08-08 | Active |
| Reports aggregate in JavaScript, not SQL `date_trunc` | Keeps the UTC month-bucketing rule reachable from unit tests with no database; personal-scale data makes the cost nil | 2026-08-09 | Active |
| Report ownership resolved by a `getCarById` pre-check, not the relation filter | Proven by mutation: dropping the pre-check fails three tests, dropping the filter fails none. Without it a stranger's car reports €0.00 instead of 404, leaking existence | 2026-08-09 | Active |
| Date bucketing is proven under non-UTC timezones, not asserted | CI runs UTC, so a default-timezone assertion can never fail. Node re-reads `process.env.TZ` at runtime, so tests run under New York and Tokyo | 2026-08-09 | Active |
| Demo data attaches to an existing user by email; never seeds a `User` | Google sign-in against a user with no linked `Account` is refused with `OAuthAccountNotLinked` — seeding first breaks login | 2026-08-09 | Active |
| The demo seed writes through the real data layer, not `createMany` | The odometer↔expense pairing is owned by `createExpense`; duplicating it would let the seed build states the app never produces | 2026-08-09 | Active |
| The demo seed hard-deletes its car, unlike normal car deletion | The soft-delete rule protects real history; undoing a seed is not that, and soft-deleting would accumulate hidden dead cars | 2026-08-09 | Active |
| Demo fixtures are deliberately imperfect | A partial fill, a fill with no reading, and one decreasing reading. A tidy series hides exactly the bugs consumption maths must survive | 2026-08-09 | Active |
| Consumption is full-to-full with partials absorbed | The fuel was burned over that distance; discarding partial fills undercounts by ~20% and reports a flatteringly low figure | 2026-08-10 | Active |
| A partial fill is never an interval endpoint, even carrying a reading | The reading makes it look usable when the tank was not full — the specific trap in the calculation | 2026-08-10 | Active |
| A backwards odometer reading invalidates its endpoint, not the series | Mis-keyed digits are commoner than replaced odometers, so the next fill rejoins the true series | 2026-08-10 | Active |
| Consumption averages are weighted by distance | The mean of per-interval rates weights a 40 km interval like a 900 km one | 2026-08-10 | Active |
| Money-derived rates round in integer space, never via `toFixed` | `toFixed` rounds by the double's actual value, so half-way cases are unpredictable per input | 2026-08-10 | Active |
| Charts are hand-rolled server-rendered SVG | No charting library, no client boundary, no dependency; Phase 4's PWA makes bundle size a stated concern | 2026-08-10 | Active |
| `/` requires a session; there is no public landing page | Matches every other page; a landing page would mean a second auth shape on a personal tool | 2026-08-10 | Active |
| Which scope filter is load-bearing is measured per query shape | `getCarReport`'s pre-check did all the work; `getFleetSummary`'s two filters are redundant with each other. The answer does not transfer | 2026-08-10 | Active |
| Development and tests use separate databases on one container | The integration suite truncates on every run; sharing one database wiped the signed-in account twice in a single session | 2026-08-10 | Active |
| `TEST_DATABASE_URL` wins over `DATABASE_URL` and overwrites it for the run | The exported production URL then becomes unreachable rather than merely unpreferred; falling back keeps CI passing with no workflow edit | 2026-08-10 | Active |
| Destructive test paths require a local host **and** a `_test` database name | Both, because a real database can satisfy one by accident; production fails both. A legitimately remote test database would be refused, which is the safe direction | 2026-08-10 | Active |
| No override flag for the guard, ever | A variable set once in `.env` is forgotten and stays true when the shell later points somewhere real — it detaches the permission from the target | 2026-08-10 | Active |
| Guard client construction, not only truncation | Measured: guarding the truncate alone stopped the data loss but still let specs write rows into the development database before reaching the refusal | 2026-08-10 | Active |
| A refusal test is aimed where a broken guard cannot do damage | Pointing it at `gaspense_dev` is the obvious test and the wrong one; the `postgres` maintenance database gives the same signal at no risk | 2026-08-10 | Active |
| The service-worker cache is an allowlist of static assets — never HTML, never `/api` | A worker outlives the page that installed it, and every page renders one user's rows behind a session; a cached navigation would survive sign-out from a store the server cannot clear | 2026-08-10 | Active |
| Hand-written service worker, not `next-pwa` and not Serwist | `next-pwa` is unmaintained and pinned to older Next.js; Serwist works but is a build-plugin dependency taken purely for convenience. The rule stays readable in one file | 2026-08-10 | Active |
| `public/sw.js` is the one plain-JS source file, as an ES **module** worker | A service worker is fetched as a static file and is not in the TypeScript build graph. Module registration is what lets its predicates be unit-tested, so the browser and the test share one source | 2026-08-10 | Active |
| Service-worker registration is production-only | `next dev` serves unhashed chunks, so a cache-first worker breaks hot reload in a way that reads as a compiler bug. e2e runs a production build, so coverage is unaffected | 2026-08-10 | Active |
| Icons rasterised by Playwright's Chromium; the PNGs are committed | No image library for four files, and Vercel serves `public/` statically without ever running the generator. A unit test parses their IHDR headers against the manifest | 2026-08-10 | Active |
| No offline writes — no background sync, no queued mutations | Queuing writes needs a conflict story this project does not have. Offline means the shell loads and says so | 2026-08-10 | Active |
| `/expenses/new` accepts no `carId` parameter | Per-car adds have their own route; a stale or foreign id would force a choice between 404, silent fallback and error, all worse than not offering it | 2026-08-10 | Active |
| The quick-add default car is the most recently **added** | `listActiveCars` already orders `createdAt: "desc"`. "Most recently used" needs a new scoped query shape, and by standing rule that means its own isolation and mutation tests — to buy a preselected `<option>` | 2026-08-10 | Active |
| The accessibility gate fails on serious/critical only | A gate that fails the build on an advisory gets switched off within a month, and then nothing is gated at all. Moderate and minor are printed and recorded | 2026-08-10 | Active |
| A new gate is not trusted until it has been made to fail | 04-02's planned control could not fire — a `placeholder` satisfies axe's accessible-name rules — so "zero violations" and "the gate is broken" were indistinguishable until a contrast regression proved it works | 2026-08-10 | Active |
| `autoFocus` only on the quick-add path | Most accessibility guidance rejects it flatly; justified for a single-purpose form opened to type one number, and deliberately not spread further | 2026-08-10 | Active |
| Attachment bytes live behind an `ObjectStorage` interface, in a gitignored `.storage/` | Supabase did not exist yet, and everything above the interface is testable without it. **Never under `public/`** — anything there is served statically with no session check | 2026-08-10 | Active |
| Attachments are served by an ownership-checked route, 404 never 403 | A signed URL works for whoever holds it until it expires; here the refusal *is* the mechanism and is testable like every other scoped path. A 403 would confirm the id exists | 2026-08-10 | Active |
| Exactly one of `Attachment.carId`/`expenseId`, enforced by a hand-written CHECK | Prisma cannot express a CHECK; the same precedent as the category partial unique indexes. Without it the rule is a comment, and comments do not reject rows | 2026-08-10 | Active |
| Three layered upload limits, discovered by measurement | Browser downscale (1600px) → validation (2 MB) → Next's server-action body (3 MB). **The Next default is 1 MB and rejects uploads silently**, stricter than Vercel's 4.5 MB | 2026-08-10 | Active |
| `deleteExpense` deletes stored objects before the row | `Attachment.expenseId` cascades, so afterwards nothing knows the storage keys — every object would be orphaned invisibly | 2026-08-10 | Active |
| Attachment ownership is an OR over car and expense, each requiring `deletedAt: null` | An attachment belongs to one or the other; scoping through `expense` alone cannot match a null `expenseId`, so a car photo 404s to its own owner. All three branches mutation-proven | 2026-08-10 | Active |
| Supabase Storage over `fetch`, with no SDK | Three REST calls do not justify the first runtime dependency since Phase 2, and an SDK would have needed the same real-service verification anyway | 2026-08-10 | Active |
| A missing Supabase variable is a hard failure, never a fall back to local | Silently reverting to local storage on Vercel's ephemeral filesystem loses every photo while each screen looks like it worked | 2026-08-10 | Active |
| The Supabase bucket must be **private** | A public bucket serves every object at a guessable URL with no session check, bypassing `/api/attachments/[id]` entirely | 2026-08-10 | Active |
| The test suites force `STORAGE_DRIVER=local`, overwritten not defaulted | `.env` reaches them through `dotenv/config`, so a developer's `supabase` driver would send every test upload into a real bucket — Phase 8's failure mode with an object store instead of a database | 2026-08-10 | Active |
| ЕГН and driving licence stored **encrypted and opt-in**, never plaintext | The fines lookup cannot run without them. Owner's decision for a personal tool, taken after the no-storage alternative was recommended. AES-256-GCM, server-only key, write-only in the UI, working delete. **Protects a database dump, not host compromise — the key lives beside the DB credentials** | 2026-08-11 | Active |
| Fines are per PERSON, the vignette per CAR | The МВР request takes a person's identifiers and returns fines across all their vehicles, each carrying `additionalData.vehicleNumber`. The original "per car" framing was wrong for fines | 2026-08-11 | Active |
| Both Bulgarian services answer HTTP 200 for logical failures | The vignette returns `ok:false` with an embedded 500 for "no vignette", and МВР returns a 429 KB HTML page when throttled. Parse the body and check the content type; never trust the status | 2026-08-11 | Active |
| An adapter is not trusted until it has run against the real service | The Supabase adapter's stub-based tests passed while the adapter was wrong: real Supabase reports a missing object as HTTP 400 with the status in the body, so `get` threw where it had to return null and the serving route would have 500ed | 2026-08-10 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Docs/lint presence | CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md exist; markdownlint + ESLint/Prettier pass | `npm run check` green | **Achieved** (Phase 0) |
| CI pipeline green | Lint + test + build pass on every push/PR; secret scanning active | All four run green: check, build, unit (Vitest), e2e (Playwright). Secret scanning + push protection active | **Achieved** (Phase 2, plan 02-02) |
| Test coverage | Unit + integration + automation (e2e) tests for every phase | 581 tests: 265 unit, 164 integration, 152 e2e — all green | **On track** |
| Security scan | Pass, every phase | - | Not started |
| Accessibility | WCAG AA on frontend phases | axe-core gates serious/critical on 4 of 9 routes, both viewports — zero found. Five routes unaudited; two blind spots measured (a placeholder satisfies accessible-name rules; nested `<a>` is parser-repaired) | **Partly achieved** (04-02) — a gate, not a certification |
| Performance | PWA installable, high Lighthouse PWA score | Manifest, maskable icons and a fetch-handling service worker all proven by test; no real device install yet, no Lighthouse run | **Partly achieved** (04-01) |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js (React), installable PWA | TypeScript end-to-end, mobile-first |
| Backend | Next.js API routes | Avoids a second service/deploy target |
| Database | PostgreSQL (Supabase) | Relational data model |
| File Storage | Supabase Storage | Car/expense photos, S3-compatible |
| Auth | Google OAuth (NextAuth) | Shared consent flow with Drive export |
| Deployment | Vercel + Supabase | Zero-maintenance free tiers |
| CI/CD | GitHub Actions | Lint + test + build gate, secret scanning |

## Links

| Resource | URL |
|----------|-----|
| Repository | https://github.com/dnmitev/gaspense |
| Production | none yet |
| Documentation | README.md, projects/gaspense/PLANNING.md |

---
*PROJECT.md — Updated when requirements or context change*
*Last updated: 2026-08-10 after Phase 4*
