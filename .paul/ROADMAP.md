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
Status: Not started
Phases: 0 of 7 complete

## Phases

**Phase Numbering:** Integer phases only for now (0–6). Decimal phases (e.g. 2.1) reserved for urgent insertions later.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 0 | AI-Friendly Project Scaffolding | TBD | Not started | - |
| 1 | CI/CD Pipeline | TBD | Not started | - |
| 2 | Foundations | TBD | Not started | - |
| 3 | Reporting | TBD | Not started | - |
| 4 | PWA & Mobile UX | TBD | Not started | - |
| 5 | Bulgarian Integrations | TBD | Not started | - |
| 6 | Google Drive Export | TBD | Not started | - |

## Phase Details

### Phase 0: AI-Friendly Project Scaffolding

**Goal:** Any AI coding agent or human contributor opening the repo has full project context and consistent code style without re-deriving them per session.
**Depends on:** Nothing (first phase)
**Research:** Unlikely (established conventions — CLAUDE.md, AGENTS.md, docs, lint config)

**Scope:**
- `CLAUDE.md` — stack, conventions, test/build commands, where PLANNING.md/PAUL state live
- `AGENTS.md` — same core context in the open agents.md cross-tool standard
- `docs/ARCHITECTURE.md` — living summary of data model, API surface, phase roadmap
- Lint/format config (ESLint, Prettier, EditorConfig)

**Plans:**
- [ ] TBD — defined during `/paul:plan`

### Phase 1: CI/CD Pipeline

**Goal:** Every subsequent phase's code is automatically linted, tested, and build-checked before reaching `main`; the public repo is protected against leaked secrets from day one.
**Depends on:** Phase 0 (lint/format config must exist for CI to run against)
**Research:** Unlikely (standard GitHub Actions patterns)

**Scope:**
- GitHub Actions workflow: lint + unit/integration tests + build on every PR
- GitHub secret scanning + push protection enabled

**Plans:**
- [ ] TBD — defined during `/paul:plan`

### Phase 2: Foundations

**Goal:** A user can log in, add a car, and record expenses against categories.
**Depends on:** Phase 1 (CI must be in place before feature code lands)
**Research:** Unlikely (NextAuth + Supabase CRUD are well-established patterns)

**Scope:**
- Google OAuth login (NextAuth)
- Car CRUD, Category CRUD (seeded defaults), Expense CRUD
- Odometer log

**Plans:**
- [ ] TBD — defined during `/paul:plan`

### Phase 3: Reporting

**Goal:** A user can see fuel cost per month/year and cost breakdown by category.
**Depends on:** Phase 2 (needs Car/Expense/Category data to aggregate)
**Research:** Unlikely (standard SQL aggregation + charting)

**Scope:**
- Monthly/yearly fuel and category cost aggregations
- Dashboard charts, cost-per-km calculation

**Plans:**
- [ ] TBD — defined during `/paul:plan`

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

---
*Roadmap created: 2026-08-07*
*Last updated: 2026-08-07*
