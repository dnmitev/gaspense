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
| Status | Prototype — Phases 0-1 complete; Phase 2 at 6 of 7 (cars and expenses usable; categories and odometer remain) |
| Last Updated | 2026-08-07 |

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

### Active (In Progress)
- Phase 2: Foundations — 6 of 7 plans complete (expenses usable end to end; Category and Odometer remain)

### Planned (Next)
- Phase 3: Reporting — monthly/yearly cost aggregations, dashboard charts, cost-per-km
- Phase 4: PWA & Mobile UX — installable PWA, quick-add flow, photo upload
- Phase 5: Bulgarian Integrations — research spike, then fines/vignette checks
- Phase 6: Google Drive Export — OAuth consent, export/backup
- Phase 7: Maintenance Reminders — service intervals per car with due/overdue indicators
- Phase 8: Test Environment Safety — stop the integration suite truncating a non-test database

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

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Docs/lint presence | CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md exist; markdownlint + ESLint/Prettier pass | `npm run check` green | **Achieved** (Phase 0) |
| CI pipeline green | Lint + test + build pass on every push/PR; secret scanning active | All four run green: check, build, unit (Vitest), e2e (Playwright). Secret scanning + push protection active | **Achieved** (Phase 2, plan 02-02) |
| Test coverage | Unit + integration + automation (e2e) tests for every phase | Unit (Vitest), integration (Postgres-backed), and e2e (Playwright) all run in CI | **On track** |
| Security scan | Pass, every phase | - | Not started |
| Accessibility | WCAG AA on frontend phases | - | Not started |
| Performance | PWA installable, high Lighthouse PWA score | - | Not started |

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
*Last updated: 2026-08-07 during Phase 2*
