---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-07)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release, Phase 2: Foundations — Planning 02-04

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 2 of 7 (Foundations) — In progress
Plan: 02-04 created, awaiting approval (4 of 6 in this phase)
Status: PLAN created, ready for APPLY
Last activity: 2026-08-07 — Created 02-04-PLAN.md (isolation-critical; has a blocking checkpoint)

Progress:
- Milestone: [██░░░░░░░░] 29% (2 of 7 phases complete)
- Phase 2: [█████░░░░░] 50% (3 of 6 plans)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ○        ○     [Plan 02-04 created, awaiting approval]
```

## Performance Metrics

6 plans complete, ~2.2h total, ~22 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 3/6 | ~27 min |

**Trend:** 13, 9, 29, 33, 14, 35 min. Cost tracks how much *unknown third-party behaviour*
a plan touches, not its file count.

## Accumulated Context

### Decisions

Only what constrains upcoming work. **Full log (28 entries): `.paul/PROJECT.md` -> Key Decisions.**

| Decision | Impact on what comes next |
|----------|---------------------------|
| Isolation is app-layer, not RLS | **02-04/05/06: every query path needs a test proving one user cannot read another's rows.** No database backstop exists |
| Money is `amountCents Int` | Every UI and report must divide by 100 to display, multiply on input. One missed conversion is a 100x error |
| Soft-delete cars only (`deletedAt`) | Every car query must filter `deletedAt: null`; expenses/odometer hard-delete |
| Schema is 5 entities | Phase 4 adds Attachment; Phase 5 adds Fine/Vignette after the research spike |
| `User` is already NextAuth-adapter-shaped | 02-04 adds only Account/Session/VerificationToken -- no `User` migration |
| Prisma 7: adapter mandatory, URLs in `prisma.config.ts` | Never `new PrismaClient()` bare; never put `url`/`directUrl` in the schema |
| Prisma scripts run under `tsx` | The generated client's imports are bundler-style and extensionless |
| Unit tests DB-free; integration separate | `npm test` must keep passing with Docker stopped |
| CLAUDE.md and AGENTS.md always change together | One set of facts in two files |
| Direct commits to `main`; push after every loop | No branch protection -- the pre-push hook is the only pre-landing gate |
| Public repo -- nothing sensitive, ever | `.env.example` placeholders only; no real plates or personal data in seeds/fixtures |
| NextAuth **v5 beta** + `@auth/prisma-adapter`, database sessions | v5 is beta but is the App Router API; sessions live in Postgres so Phase 6 gets the Google refresh token free |
| Google OAuth credentials are the user's to create | Automated tests create sessions directly in the DB; a real login is a manual check the user performs |

### Deferred Issues

| Issue | Origin | Effort | Revisit |
|-------|--------|--------|---------|
| Bulgarian fines/vignette lookup mechanism unconfirmed | Ideation | M | Before Phase 5 — `/paul:discover` |
| Fines/vignette check cadence undecided | Ideation | S | After the Phase 5 spike |
| Licence unsettled — `UNLICENSED` avoids npm's default ISC grant on a public repo | Phase 0 | S | User's call, any time |
| Non-provider secret-scanning patterns unavailable — needs GitHub's paid Secret Protection tier | Phase 1 | — | Only under org licensing |

### Blockers/Concerns

| Concern | Impact | Resolution Path |
|---------|--------|-----------------|
| Next.js owns a section of AGENTS.md | Hand-edits inside the `nextjs-agent-rules` block are silently overwritten on `next dev` | Edit only outside the markers |
| e2e step rebuilds the app, duplicating the Build step | Slower CI runs | Accepted; optimising means touching 01-01's verified workflow structure |
| **`@auth/prisma-adapter` peer-declares `@prisma/client >=2..>=6`, NOT >=7** | We run Prisma 7.9.1; the adapter may not work | 02-04 Task 1 retires this risk first, with a documented escalation if it fails |
| PROJECT.md had 16 duplicated rows from a repeated UNIFY edit | Authoritative decision log was unreliable | Fixed during 02-04 planning; deduped and verified |

**Resolved:** CI success metric and stale agent docs (02-02); `.env.example` and the
`docs/ARCHITECTURE.md` schema update (02-03).

## Boundaries (Active)

From plan 02-04 (plus the standing "do not break these"):

- **No `ALTER COLUMN` or `DROP` on any existing table** — 02-04's migration must be additive only
- **No real credentials committed** — the user supplies `AUTH_*` values in `.env` themselves
- **No Google Drive scopes** in the OAuth consent — Phase 6 owns that

- **Never run `prisma init` again** -- re-injects 71 agent-skill files and edits `.gitignore`
- **Never run `create-next-app`** here -- clobbers README.md, .gitignore, eslint.config.mjs, scripts
- **Never edit inside AGENTS.md's `nextjs-agent-rules` markers** -- Next regenerates that block
- **Keep `afterEach(cleanup)` in `tests/unit/setup.ts`** -- looks like boilerplate, prevents DOM leaks
- ESLint stays on 9 -- `eslint-config-next`'s plugins crash on 10
- CI triggers, `permissions`, `concurrency` -- verified in 01-01, not to be restructured
- `.paul/**`, `projects/**`, `.claude/settings.json` -- untouched by tooling
- `npm run check` must stay green; the pre-push hook enforces it

### Git State

Branch: `main` · Feature branches: none (direct-to-`main` workflow)

## Session Continuity

Last session: 2026-08-07 (resumed; handoff consumed and archived to `.paul/handoffs/archive/`)
Stopped at: Plan 02-04 created — 3 tasks + 1 blocking human-verify checkpoint (`autonomous: false`)
Next action: Review and approve plan, then run `/paul:apply .paul/phases/02-foundations/02-04-PLAN.md`
Resume file: `.paul/phases/02-foundations/02-04-PLAN.md`
Git strategy: `main` (direct commits)
Resume context:
- Phase 2 is 3 of 6 -- NOT complete; the file-count heuristic has now given a false positive four times. ROADMAP is the authority.
- **02-04's first task retires a real risk:** `@auth/prisma-adapter` does not declare Prisma 7 support. If it fails, STOP and escalate — pinning Prisma 6, hand-writing an adapter, and switching to JWT all have costs that are the user's call.
- 02-04 is `autonomous: false` — it ends with an optional human-verify checkpoint for a real Google login, which needs credentials only the user can create.
- Local dev needs `docker compose up -d` (Postgres on **5433**) before `npm run test:integration`.
- **Never read an exit code through a pipe** -- this has caused a wrong conclusion three times.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
