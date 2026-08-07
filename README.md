# Gaspense

Mobile-first PWA for tracking personal vehicle expenses — fuel, maintenance, taxes, body work, fines, and vignette status — with real cost reporting and Google Drive export. Built for personal use and shared with friends/family; not for sale.

**Type:** Application
**Skill Loadout:** PAUL (required), AEGIS (recommended), ui-ux-pro-max (recommended)
**Quality Gates:** docs/lint presence, unit + integration + automation tests per phase, security scan, accessibility, performance

---

## Overview

Existing apps like Fuelio, CarDiary, and CarSpending come close but not close enough — Gaspense is a self-built alternative for tracking the _real_ total cost of vehicle ownership in one place, with proper reporting (cost per month/year) instead of scattered receipts. The core first-use moment: add a car, log a fuel fill-up.

Each user has their own account and sees only their own cars and expenses — this is a shared tool, not a shared dataset.

---

## Stack

| Layer        | Choice                             | Rationale                                                                                         |
| ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Frontend     | Next.js (React) as installable PWA | TypeScript end-to-end, one codebase for UI + API, mature PWA tooling, mobile-first out of the box |
| Backend      | Next.js API routes                 | Avoids a second service/deploy target                                                             |
| Database     | PostgreSQL (via Supabase)          | Data is relational (cars → expenses → categories, fines/vignette per car)                         |
| File Storage | Supabase Storage                   | Same provider as the DB — one free tier, S3-compatible, for car/expense photos                    |
| Auth         | Google OAuth (NextAuth)            | No password management; shares consent flow with Google Drive export                              |

## Deploy

Vercel (app, preview deployments per PR, production on `main`) + Supabase (Postgres + Storage, single free-tier project). GitHub Actions runs lint + unit/integration tests + build on every PR.

**Public repo:** nothing sensitive is ever committed. Only `.env.example` (placeholders) is tracked; GitHub secret scanning + push protection are enabled; no real license plates, personal data, or credentials appear in fixtures, seed data, or screenshots.

**Research needed:** neither the Bulgarian traffic police (КАТ/МВР) fines lookup nor the vignette-validity check has a confirmed public REST API. A `/paul:discover` spike is required before that phase to establish what's actually callable.

---

## Data Model

| Entity          | Key Fields                                                          | Relationships                                                                                                 |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| User            | id, email, name, googleId                                           | has many Cars                                                                                                 |
| Car             | id, userId, licensePlate, make, model, year, fuelType, nickname     | belongs to User; has many Expenses, OdometerReadings, Fines, Attachments; has one current Vignette status     |
| Category        | id, userId (nullable for system defaults), name, type               | has many Expenses                                                                                             |
| Expense         | id, carId, categoryId, date, amount (EUR), odometerReading, notes   | belongs to Car and Category; fuel expenses add liters, pricePerLiter, station, fullTank; has many Attachments |
| OdometerReading | id, carId, date, reading, source                                    | belongs to Car — first-class log, not just derived from expenses                                              |
| Fine            | id, carId, source ("KAT"), amount, date, referenceNumber, status    | belongs to Car; populated via external check                                                                  |
| Vignette        | id, carId, validFrom, validTo, checkedAt, status                    | belongs to Car; populated via external check                                                                  |
| Attachment      | id, carId (nullable), expenseId (nullable), storagePath, uploadedAt | belongs to a Car or an Expense; stored in Supabase Storage                                                    |

Currency is EUR only. Default seeded categories: Fuel, Maintenance, Body Work, Insurance, Taxes/Fees, Fines, Vignette, Parking, Tires, Other — user-editable.

---

## API Surface

REST via Next.js API routes. NextAuth (Google OAuth) + JWT session; every route scoped by authenticated `userId`.

| Group              | Methods                  | Purpose                                              |
| ------------------ | ------------------------ | ---------------------------------------------------- |
| /api/cars          | GET, POST, PATCH, DELETE | Car CRUD                                             |
| /api/expenses      | GET, POST, PATCH, DELETE | Expense CRUD, filterable by car/category/date        |
| /api/categories    | GET, POST, PATCH, DELETE | Category CRUD                                        |
| /api/odometer      | GET, POST                | Odometer log per car                                 |
| /api/reports       | GET                      | Aggregated cost-per-month/year, per-category, per-km |
| /api/fines         | GET, POST /check         | Stored fines + trigger external KAT lookup           |
| /api/vignette      | GET, POST /check         | Stored vignette status + trigger external check      |
| /api/attachments   | POST, DELETE             | Upload/delete car or expense photos                  |
| /api/export/gdrive | POST                     | Trigger export/backup to Google Drive                |

Private app — no public endpoints. Rate limiting applies to `/api/fines/check` and `/api/vignette/check` since they hit external government services.

---

## Architecture

Single Next.js app (frontend + API routes) backed by Supabase (Postgres + Storage), deployed on Vercel. Google OAuth is the sole identity provider, reused for the Google Drive export consent flow. GitHub Actions gates every merge to `main` with lint/test/build and secret scanning.

## UI/UX

Mobile-first, installable PWA (Tailwind + shadcn/ui). Key views: Dashboard (cost charts by month/year/category), Car list/detail, quick Add-Expense flow (the core fast action), Odometer log, Fines & Vignette status, Settings (Google Drive connect, categories). No real-time requirements.

---

## Implementation Phases

### Phase 0: AI-Friendly Project Scaffolding

`CLAUDE.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, lint/format config — established before any app code so every phase and every AI agent has full context from the start.

### Phase 1: CI/CD Pipeline

GitHub Actions (lint + test + build on every PR), secret scanning + push protection — set up before feature code exists.

### Phase 2: Foundations

Google OAuth login, Car CRUD, Category CRUD, Expense CRUD, Odometer log. **Outcome:** log in, add a car, record expenses.

### Phase 3: Reporting

Monthly/yearly fuel and category cost aggregations, dashboard charts, cost-per-km. **Outcome:** see fuel cost per month/year and category breakdown.

### Phase 4: PWA & Mobile UX

Installable PWA, fast quick-add expense flow, responsive polish, car/expense photo upload. **Outcome:** installs on a phone home screen, adding an expense takes seconds.

### Phase 5: Bulgarian Integrations

Research spike (`/paul:discover`), then fines check + vignette validity check with rate limiting. **Outcome:** check fines/vignette status per car in-app.

### Phase 6: Google Drive Export

Google Drive OAuth consent, export/backup to Drive. **Outcome:** export data to your own Google Drive on demand.

Every phase ships with unit + integration + automation (e2e) tests, per the project's testing requirement.

---

## Design Decisions

1. PostgreSQL over MongoDB — the data is inherently relational (cars → expenses → categories, fines/vignette per car).
2. Supabase for both DB and Storage — one provider, one free tier, S3-compatible storage alongside Postgres.
3. Google OAuth for auth — no password management, reuses the Google Drive consent flow.
4. Separate accounts per person — real per-user data isolation, not shared household login.
5. EUR only — no multi-currency conversion logic.
6. Odometer as a first-class log — independent of expenses, for accurate efficiency calculations.
7. Attachments use nullable dual foreign keys (carId/expenseId) — simplest shape for two possible owners.
8. Bulgarian government integrations deferred to Phase 5 with an explicit research spike — no confirmed public API exists yet.
9. AI-friendly scaffolding as Phase 0 — full project context before any feature code.
10. CI/CD as Phase 1, before Foundations — every phase from there on is automatically checked.
11. Direct commits to `main` — explicitly authorized for this low-risk personal project; revisit if collaborators join.
12. Public repo, no sensitive data ever committed — real credentials live only in environment variables.

---

## Open Questions

1. What is the actual callable mechanism (endpoint, required identifiers, auth) for the Bulgarian traffic police fines lookup and the vignette validity check? Needs the Phase 5 research spike.
2. Should fines/vignette checks run on a schedule or only manual trigger? Deferred until the research spike clarifies rate limits and terms of use.
3. Car deletion/data retention policy — hard delete vs soft delete?

---

## References

- Fuelio, CarDiary, CarSpending — prior art
- Full ideation history: [`projects/gaspense/PLANNING.md`](projects/gaspense/PLANNING.md)
