---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-07)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release, Phase 2: Foundations — 1 of 6 plans complete

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 2 of 7 (Foundations) — In progress
Plan: 02-01 complete (loop closed)
Status: Ready for next PLAN (02-02)
Last activity: 2026-08-07 — Closed loop 02-01; app builds and serves, CI gates check + build

Progress:
- Milestone: [██░░░░░░░░] 29% (2 of 7 phases complete)
- Phase 2: [██░░░░░░░░] 17% (1 of 6 plans)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — ready for next PLAN]
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
| CI success metric is only partially achieved — lint gate only, no test/build | PROJECT.md metric reads "lint + test + build" | Phase 2 adds both scripts and the matching CI steps, completing the metric |
| **Agent docs are currently WRONG** — CLAUDE.md and AGENTS.md still list `npm run dev` and `npm run build` under "Not available yet", but both now exist | An agent reading them is misinformed today | **02-02's first obligation**: correct both files in one commit, alongside adding the test scripts |
| Next.js owns a section of AGENTS.md | Hand-edits inside the `nextjs-agent-rules` block are silently overwritten on `next dev` | Edit only outside the markers |

## Boundaries (Active)

None — set when 02-02's PLAN.md is created. Standing constraints:

- **Never run `create-next-app` in this directory** — it clobbers README.md, .gitignore, eslint.config.mjs, and package.json scripts
- Never edit inside AGENTS.md's `nextjs-agent-rules` markers — Next regenerates that block
- CI triggers, `permissions`, and `concurrency` — verified in 01-01, not to be restructured
- `.paul/**`, `projects/**`, `.claude/settings.json` — untouched by tooling
- `npm run check` must stay green; the pre-push hook enforces it on every push

### Git State

Branch: `main` · Feature branches: none (direct-to-`main` workflow)

## Session Continuity

Last session: 2026-08-07 (**PAUSED** at a clean stopping point — nothing in progress)
Stopped at: Plan 02-01 loop closed and pushed. Working tree clean, `4ae4744` in sync with origin, CI green, gate green.
Next action: Run `/paul:plan` for 02-02 — **first obligation is fixing the stale agent docs**, then Vitest + Playwright, `test`/`test:e2e` scripts + CI steps, `.env.example`
Resume file: `.paul/HANDOFF-2026-08-07.md` (full zero-context briefing)
Git strategy: `main` (direct commits; no feature branch, no WIP commit needed — tree was clean)
Resume context:
- Phase 2 is 1 of 6 plans done — **NOT complete**; the transition was deliberately withheld because PAUL's PLAN/SUMMARY file-count heuristic gives a false positive here. ROADMAP is the authority.
- `CLAUDE.md`/`AGENTS.md` currently claim `npm run dev` and `npm run build` are "not available yet" — both exist. Fix both files in one commit.
- Standing traps: never read an exit code through a pipe; ESLint frozen at 9 (eslint-config-next plugins crash 10); Next 16 regenerates the `nextjs-agent-rules` block in AGENTS.md; never run `create-next-app` here; Tailwind 4 is CSS-first.
- Remaining plans: 02-02 test infra + docs fix, 02-03 Prisma schema + ARCHITECTURE update, 02-04 NextAuth, 02-05 Car slice, 02-06 Category/Expense/Odometer.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
