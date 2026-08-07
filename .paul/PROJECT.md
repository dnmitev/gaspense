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
| Status | Prototype (ideation complete, no code yet) |
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

### Validated (Shipped)
None yet.

### Active (In Progress)
None yet.

### Planned (Next)
- Phase 0: AI-Friendly Project Scaffolding — CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md, lint/format config
- Phase 1: CI/CD Pipeline — GitHub Actions lint/test/build gate, secret scanning
- Phase 2: Foundations — Google OAuth, Car/Category/Expense CRUD, odometer log
- Phase 3: Reporting — monthly/yearly cost aggregations, dashboard charts, cost-per-km
- Phase 4: PWA & Mobile UX — installable PWA, quick-add flow, photo upload
- Phase 5: Bulgarian Integrations — research spike, then fines/vignette checks
- Phase 6: Google Drive Export — OAuth consent, export/backup

### Out of Scope
- Multi-currency support — EUR only, by explicit decision
- Shared/household accounts — each person has a separate account and dataset
- Public/multi-tenant SaaS features — this is a personal tool, not a product
- Real-time dashboards/live updates — not needed for a personal logging app

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

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Docs/lint presence | CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md exist; markdownlint + ESLint/Prettier pass | - | Not started |
| CI pipeline green | Lint + test + build pass on every PR; secret scanning active | - | Not started |
| Test coverage | Unit + integration + automation (e2e) tests for every phase | - | Not started |
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
*Last updated: 2026-08-07*
