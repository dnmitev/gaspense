# Gaspense

> Mobile-first PWA for tracking personal vehicle expenses (fuel, maintenance, taxes, fines, vignette) with reporting and Google Drive export — for personal use and friends/family, not for sale.

**Created:** 2026-08-07
**Type:** Application
**Stack:** Next.js (TypeScript) + Supabase (Postgres + Storage) + Vercel
**Skill Loadout:** PAUL (required), AEGIS (recommended), ui-ux-pro-max (recommended)
**Quality Gates:** unit + integration + automation tests per phase, security scan, accessibility, performance

---

## Problem Statement

Existing apps like Fuelio, CarDiary, and CarSpending are close but not quite right — this is a self-built alternative for personal use, extended to friends and family, with no intent to sell or monetize. The core pain point: tracking real total cost of vehicle ownership (fuel, maintenance, taxes, body work, fines, vignette) in one place with real reporting (cost per month/year), not scattered receipts and memory. The "first 5 minutes" action is adding a car and logging a fuel fill-up.

This is dogfooding — built by and for someone who wants this exact tool to exist, shared with people the owner trusts.

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js (React) as installable PWA | TypeScript end-to-end, one codebase for UI + API, mature PWA tooling, mobile-first out of the box |
| Backend | Next.js API routes | Avoids a second service/deploy target; fine for this scale |
| Database | PostgreSQL (via Supabase) | Data is relational (cars → expenses → categories, fines/vignette per car) — joins and aggregations for reporting are far simpler than in a document store |
| File Storage | Supabase Storage | Same provider as the DB — one dashboard, one free tier, S3-compatible for car and expense photos |
| Auth | Google OAuth (NextAuth) | Everyone already has a Google account; no password management; shares consent flow with Google Drive export |
| Deployment | Vercel (app) + Supabase (DB + Storage) | Zero-maintenance cloud free tiers, works from anywhere immediately, no server to patch |

### Research Needed
- Confirm the actual (undocumented) endpoints/mechanism behind the Bulgarian traffic police (КАТ/МВР) fines lookup and the vignette-validity check — no official public REST API is confirmed to exist. Run `/paul:discover` before Phase 4 to establish what's actually callable, its auth/rate-limit behavior, and a fallback plan if nothing stable is found.

---

## Data Model

### Entities

| Entity | Key Fields | Relationships |
|--------|-----------|---------------|
| User | id, email, name, googleId | has many Cars |
| Car | id, userId, licensePlate, make, model, year, fuelType, nickname | belongs to User; has many Expenses, OdometerReadings, Fines, Attachments; has one current Vignette status |
| Category | id, userId (nullable for system defaults), name, type | has many Expenses |
| Expense | id, carId, categoryId, date, amount (EUR), odometerReading, notes | belongs to Car and Category; fuel-type expenses add liters, pricePerLiter, station, fullTank; has many Attachments |
| OdometerReading | id, carId, date, reading, source (manual/expense) | belongs to Car — first-class log, not just derived from expenses |
| Fine | id, carId, source ("KAT"), amount, date, referenceNumber, status | belongs to Car; populated via external check |
| Vignette | id, carId, validFrom, validTo, checkedAt, status | belongs to Car; populated via external check |
| Attachment | id, carId (nullable), expenseId (nullable), storagePath, uploadedAt | belongs to either a Car or an Expense (photos/receipts), stored in Supabase Storage |

### Notes
- Odometer tracked as its own log (not just inferred from expenses) to support accurate fuel efficiency (L/100km) and future service-interval reminders.
- Currency: EUR only — no multi-currency conversion needed.
- Default seeded categories: Fuel, Maintenance, Body Work, Insurance, Taxes/Fees, Fines, Vignette, Parking, Tires, Other — user-editable and extensible.
- Attachment uses a nullable dual foreign key (carId / expenseId) rather than a separate join table — simplest shape for two possible owners.

---

## API Surface

{REST via Next.js API routes.}

### Auth Strategy
NextAuth with Google OAuth provider, JWT session. Every API route scoped by authenticated `userId` — no cross-user data access (separate accounts per person, not shared household access).

### Route Groups

| Group | Methods | Auth | Purpose |
|-------|---------|------|---------|
| /api/cars | GET, POST, PATCH, DELETE | required | Car CRUD |
| /api/expenses | GET, POST, PATCH, DELETE | required | Expense CRUD, filterable by car/category/date |
| /api/categories | GET, POST, PATCH, DELETE | required | Category CRUD (defaults + user-added) |
| /api/odometer | GET, POST | required | Odometer log per car |
| /api/reports | GET | required | Aggregated cost-per-month/year, cost-per-category, cost-per-km |
| /api/fines | GET, POST /check | required | Stored fines + trigger external KAT lookup |
| /api/vignette | GET, POST /check | required | Stored vignette status + trigger external check |
| /api/attachments | POST, DELETE | required | Upload/delete car or expense photos (Supabase Storage) |
| /api/export/gdrive | POST | required | Trigger export/backup to Google Drive |

### Internal vs External
- **Public endpoints:** none — this is a private, authenticated app.
- **Internal/admin endpoints:** none planned at this scale.
- **MCP integration points:** none.

---

## Deployment Strategy

### Local Development
| Service | Image/Runtime | Port | Purpose |
|---------|--------------|------|---------|
| app | Node 20 (Next.js dev server) | 3000 | Main application |
| Supabase local (optional) | Supabase CLI / Docker | 54321+ | Local Postgres + Storage emulation for dev |

### Staging / Production
Vercel for the app (preview deployments per PR, production on main), Supabase for Postgres + Storage (single project, free tier), GitHub Actions running unit/integration tests on every PR before merge.

---

## Security Considerations

- **Auth/Authz model:** Google OAuth via NextAuth; JWT session; every query scoped to the authenticated user's own data (per-person accounts, no shared access).
- **Input validation:** Schema validation (e.g. Zod) at every API route boundary, especially expense amounts, dates, and license plate format.
- **OWASP concerns:** Access control (ensure userId scoping can't be bypassed via ID enumeration), SSRF-adjacent risk on the fines/vignette external calls (validate/allowlist target hosts once confirmed), secure handling of OAuth tokens.
- **Secrets management:** Google OAuth client secret, Supabase service keys — stored as Vercel/Supabase environment variables, never committed.
- **Rate limiting:** Applied to `/api/fines/check` and `/api/vignette/check` specifically — these hit external government services and must not be hammered or triggered in tight loops.

---

## UI/UX Needs

### Design System
Tailwind + shadcn/ui — fast to ship, consistent mobile-first components; `ui-ux-pro-max` skill for implementation help.

### Key Views / Pages

| View | Purpose | Complexity |
|------|---------|------------|
| Dashboard | Cost charts by month/year/category, per-car summary | high — charts + aggregation |
| Car list / Car detail | Manage cars, view photos, per-car history | medium |
| Add Expense (quick flow) | Fastest possible entry — the core first-5-minutes action | medium — needs to be frictionless |
| Odometer log | Manual readings, history per car | low |
| Fines & Vignette status | Per-car status, trigger manual check | medium — depends on external integration |
| Settings | Google Drive connect/export, category management | low |

### Real-Time Requirements
None planned — this is a personal logging app, not a live dashboard.

### Responsive Needs
Mobile-first, installable PWA; desktop usable but not the primary target.

---

## Integration Points

| Integration | Type | Purpose | Auth |
|------------|------|---------|------|
| Bulgarian traffic police (КАТ/МВР) fines check | REST (unconfirmed) | Look up outstanding fines per car | TBD — research needed |
| Vignette validity check | REST (unconfirmed) | Confirm current vignette status per car | TBD — research needed |
| Google Drive API v3 | REST + OAuth2 | Export/backup expense data | OAuth2 (shared with login consent) |
| Supabase Storage | S3-compatible API | Car and expense photo storage | Supabase service key |

---

## Phase Breakdown

### Phase 1: Foundations
- **Build:** Google OAuth login, Car CRUD, Category CRUD (with seeded defaults), Expense CRUD, Odometer log
- **Testable:** Unit tests on validation/model logic, integration tests on CRUD API routes, e2e smoke test for "add car → add expense"
- **Outcome:** A user can log in, add a car, and record expenses against categories

### Phase 2: Reporting
- **Build:** Monthly/yearly fuel and category cost aggregations, dashboard charts, cost-per-km calculation
- **Testable:** Unit tests on aggregation logic, integration tests on `/api/reports`, e2e test viewing the dashboard with seeded data
- **Outcome:** A user can see fuel cost per month/year and cost breakdown by category

### Phase 3: PWA & Mobile UX
- **Build:** Installable PWA manifest/service worker, fast quick-add expense flow, responsive polish, car/expense photo upload (Attachments + Supabase Storage)
- **Testable:** Lighthouse PWA audit, e2e test for install + offline-tolerant quick-add, upload/retrieve photo integration test
- **Outcome:** App installs on a phone home screen and adding an expense (with an optional photo) takes seconds

### Phase 4: Bulgarian Integrations
- **Build:** Research spike (`/paul:discover`) to confirm callable fines/vignette mechanisms, then implement `/api/fines/check` and `/api/vignette/check` with rate limiting
- **Testable:** Contract/integration tests against mocked external responses, manual verification against the real service, rate-limit behavior test
- **Outcome:** A user can check whether a car has outstanding fines or a valid vignette from within the app

### Phase 5: Google Drive Export
- **Build:** Google Drive OAuth consent (reusing login provider), export/backup of expense data to Drive
- **Testable:** Integration test with mocked Drive API, e2e test for the export flow end-to-end
- **Outcome:** A user can export their data to their own Google Drive on demand

---

## Skill Loadout & Quality Gates

### Skills Used During Build

| Skill | When It Fires | Purpose |
|-------|--------------|---------|
| ui-ux-pro-max | Frontend/PWA phases (1, 3) | Design system, responsive/PWA component quality |
| /paul:discover | Before Phase 4 | Research the actual fines/vignette lookup mechanism before committing to an implementation |
| /paul:audit | End of each milestone | Architecture review |
| AEGIS | Post-build, and especially after Phase 4/5 | Security/quality audit — OWASP issues around auth, external API calls, OAuth token handling |

### Quality Gates

| Gate | Threshold | When |
|------|-----------|------|
| Test coverage | Unit + integration + automation (e2e) for every phase | each phase, per user's explicit requirement |
| Security scan | pass | each phase, especially auth (1) and integrations (4, 5) |
| Accessibility | WCAG AA | frontend phases (1, 2, 3) |
| Performance | PWA installable, Lighthouse PWA score high | Phase 3 and final milestone |

---

## Design Decisions

1. **PostgreSQL over MongoDB**: chosen because the data (cars → expenses → categories, fines/vignette per car) is inherently relational; reporting aggregations are simpler with SQL joins than document restructuring.
2. **Supabase for both DB and Storage**: chosen after deciding to store car/expense photos — one provider, one free tier, one dashboard, S3-compatible storage alongside Postgres.
3. **Google OAuth for auth**: chosen over email/password or magic links — zero password management for family/friends users, and reuses the same consent flow needed for Google Drive export.
4. **Separate accounts per person**: each user sees only their own cars/expenses — requires real per-user data isolation, not shared household login.
5. **EUR only, no multi-currency**: simplifies all reporting and storage — no conversion logic needed.
6. **Odometer as a first-class log**: tracked independently of expenses (not just inferred from fuel fill-ups) to support accurate efficiency calculations and future service-interval features.
7. **Attachments modeled with nullable dual foreign keys (carId/expenseId)**: simplest shape to support photos on both cars and expenses without a separate polymorphic join table.
8. **Bulgarian government integrations deferred to Phase 4 with an explicit research spike**: no confirmed public API exists for either the fines lookup or vignette check — implementation is deferred until `/paul:discover` establishes what's actually callable.

---

## Open Questions

1. What is the actual callable mechanism (endpoint, required identifiers, auth) for the Bulgarian traffic police fines lookup and the vignette validity check? Needs a research spike before Phase 4.
2. Should fines/vignette checks run automatically on a schedule (e.g. daily) or only on manual user trigger? Deferred until the research spike clarifies rate limits and terms of use.
3. Any car deletion/data retention policy — hard delete vs soft delete for cars and their expense history?

---

## Next Actions

- [ ] Run `/seed launch gaspense` (or `/seed graduate gaspense` then `/paul:init`) to move into managed build
- [ ] Kick off `/paul:discover` research spike on Bulgarian fines/vignette integrations early, in parallel with Phase 1-3 build, so Phase 4 isn't blocked

---

## References

- Fuelio, CarDiary, CarSpending — prior art referenced by the user as similar existing apps

---

*Last updated: 2026-08-07*
