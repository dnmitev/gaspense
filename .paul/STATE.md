---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-07)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release, Phase 2: Foundations — Applying 02-02

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 2 of 7 (Foundations) — In progress
Plan: 02-02 executed, 3 of 3 tasks complete
Status: APPLY complete, ready for UNIFY
Last activity: 2026-08-07 — Executed 02-02: Vitest + Playwright, CI test steps, agent docs corrected

Progress:
- Milestone: [██░░░░░░░░] 29% (2 of 7 phases complete)
- Phase 2: [██░░░░░░░░] 17% (1 of 6 plans)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ◉     [Ready for UNIFY]
```

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~21 min
- Total execution time: ~1.4 hours

**By Phase:**

| Phase | Plans | Total Time | Avg/Plan |
|-------|-------|------------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~22 min | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min | ~29 min |
| 02-foundations | 1/6 | ~33 min | ~33 min |

**Recent Trend:** Last 4 plans: 13, 9, 29, 33 min. Plans involving live external
verification (CI runs, dev server, dependency diagnosis) cost ~3x doc-only plans.

## Accumulated Context

### Decisions

Digest of decisions that constrain upcoming work. **Full log: `.paul/PROJECT.md` → Key Decisions.**

| Decision | Phase | Impact |
|----------|-------|--------|
| Next.js + Supabase (Postgres + Storage) + Vercel, Google OAuth | Ideation | Fixes the stack for all remaining phases |
| Direct commits to `main`, no PR-per-change | Ideation | No branch/PR overhead; still push after every loop |
| Public repo — nothing sensitive ever committed | Ideation | `.env.example` only; no real plates or personal data in fixtures |
| npm as package manager | Phase 0 | Phase 1 CI uses `npm ci` + npm caching |
| No `test`/`build` script yet | Phase 0 | **Phase 2 must add both scripts AND the matching CI steps** |
| CLAUDE.md and AGENTS.md are edited together | Phase 0 | Phase 2 must move `dev`/`build`/`test` out of "not available yet" in both files, same commit |
| CI triggers on `push` to `main`; no branch protection | Phase 1 | The pre-push hook is the only pre-landing gate, and it is bypassable with `--no-verify` |
| Node 22 floor (20 is EOL) | Phase 1 | Keep `engines`, CI, and any Vercel runtime aligned; Node 22 itself EOLs 2027-04-30 |
| NextAuth kept over Supabase Auth | Phase 2 | Phase 6 needs Google refresh tokens; **isolation is app-layer, not RLS — every query path must be tested for leakage** |
| Prisma as data layer | Phase 2 | Watch connection pooling on Vercel serverless |
| Vitest + Playwright | Phase 2 | `test` and `test:e2e` scripts land in 02-02 |
| Soft-delete cars only (`deletedAt`) | Phase 2 | Car queries must filter deleted rows; expenses/odometer hard-delete |
| **ESLint pinned to 9, not 10** | Phase 2 (02-01) | `eslint-config-next`'s bundled plugins cap at ^9 and crash ESLint 10. Do not upgrade ESLint until they support 10 |
| **Next.js 16 rewrites AGENTS.md** | Phase 2 (02-01) | `next dev` re-injects an H1 agent-rules block; MD025 is disabled because of it. Commit the block, never fight it |
| Tailwind 4 is CSS-first | Phase 2 (02-01) | Theme customisation goes in `app/globals.css` via `@theme` — there is no `tailwind.config.js` |
| **e2e serves the production build, never `next dev`** | Phase 2 (02-02) | Verified: `next build` does not touch AGENTS.md but `next dev` regenerates it, which would dirty the tree on every test run |
| `.env.example` deferred to 02-03 | Phase 2 (02-02) | Writing it before `DATABASE_URL` exists would document unused variables |
| **Vitest runs `globals: false`** | Phase 2 (02-02) | Testing Library's auto-cleanup does NOT register; it is wired by hand in `tests/unit/setup.ts`. Removing it causes cross-test DOM leaks |
| `docs/ARCHITECTURE.md` is the living design doc | Phase 0 | Must be updated in Phase 2 when the real schema lands, or it misleads |

### Deferred Issues

| Issue | Origin | Effort | Revisit |
|-------|--------|--------|---------|
| Bulgarian fines/vignette lookup mechanism unconfirmed | Ideation | M | Before Phase 5 — run `/paul:discover` |
| Fines/vignette check cadence (scheduled vs manual-only) undecided | Ideation | S | After the Phase 5 research spike |
| Licence choice unsettled — `UNLICENSED` set to avoid npm's default ISC grant on a public repo | Phase 0 (00-02) | S | User's call; any time |
| Non-provider secret-scanning patterns not available — no UI toggle exists and the API silently ignores the field; appears to need GitHub's paid Secret Protection tier, not the free public-repo set | Phase 1 (01-01) | — | Only if the repo moves to an org with that licensing |

### Blockers/Concerns

| Concern | Impact | Resolution Path |
|---------|--------|-----------------|
| Next.js owns a section of AGENTS.md | Hand-edits inside the `nextjs-agent-rules` block are silently overwritten on `next dev` | Edit only outside the markers |
| e2e step rebuilds the app, duplicating the Build step | Slower CI runs | Accepted; optimising means touching 01-01's verified workflow structure |

**Resolved by 02-02:** the CI success metric (lint + test + build now all run and pass) and the
stale agent docs (both corrected in one commit).

## Boundaries (Active)

From plan 02-02:

- **Never edit inside AGENTS.md's `nextjs-agent-rules` markers** — Next regenerates that block
- **Never run `create-next-app` in this directory** — it clobbers README.md, .gitignore, eslint.config.mjs, and package.json scripts
- ESLint stays on 9 — `eslint-config-next`'s bundled plugins crash on 10
- `.gitignore` already covers all test output; verified, no edit needed
- CI triggers, `permissions`, and `concurrency` — verified in 01-01, not to be restructured
- `app/page.tsx` / `app/layout.tsx` — tested by 02-02, not changed by it
- `.paul/**`, `projects/**`, `.claude/settings.json` — untouched by tooling
- `npm run check` must stay green; the pre-push hook enforces it on every push

### Git State

Branch: `main` · Feature branches: none (direct-to-`main` workflow)

## Session Continuity

Last session: 2026-08-07 (resumed; handoff consumed and archived to `.paul/handoffs/archive/`)
Stopped at: Plan 02-02 APPLY complete — both runners proven failable, CI green across check/build/unit/e2e
Next action: Run `/paul:unify .paul/phases/02-foundations/02-02-PLAN.md` to close the loop
Resume file: `.paul/phases/02-foundations/02-02-PLAN.md`
Git strategy: `main` (direct commits)
Resume context:
- 02-02 adds Vitest + Playwright, the `test`/`test:e2e`/`start` scripts and CI steps, and **corrects the agent docs, which currently misstate that `dev`/`build` are unavailable**.
- Playwright must serve `next start`, not `next dev` — verified that dev regenerates the AGENTS.md block and would dirty the tree every run.
- `.env.example` moved to 02-03, where `DATABASE_URL` makes it real.
- Standing traps: never read an exit code through a pipe; ESLint frozen at 9; never edit inside the `nextjs-agent-rules` markers.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
