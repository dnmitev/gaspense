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
Phases: 2 of 7 complete (29%)

## Phases

**Phase Numbering:** Integer phases only for now (0–6). Decimal phases (e.g. 2.1) reserved for urgent insertions later.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 0 | AI-Friendly Project Scaffolding | 2/2 | ✅ Complete | 2026-08-07 |
| 1 | CI/CD Pipeline | 1/1 | ✅ Complete | 2026-08-07 |
| 2 | Foundations | 1/6 | In progress | - |
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
- [ ] 02-02: Vitest + Playwright, `test`/`test:e2e` scripts + CI steps, `.env.example`, **fix the now-stale `dev`/`build` wording in both agent docs**
- [ ] 02-03: Prisma schema + migrations + seeded default categories, `docs/ARCHITECTURE.md` update
- [ ] 02-04: NextAuth Google OAuth, session handling, per-user scoping helper
- [ ] 02-05: Car CRUD vertical slice (API + UI + tests, incl. soft delete)
- [ ] 02-06: Category, Expense, and Odometer CRUD vertical slice

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
