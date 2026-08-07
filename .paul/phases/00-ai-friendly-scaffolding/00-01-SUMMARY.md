---
phase: 00-ai-friendly-scaffolding
plan: 01
subsystem: infra
tags: [documentation, agents-md, gitignore, secrets-hygiene, public-repo]

# Dependency graph
requires: []
provides:
  - Agent entry-point documentation (CLAUDE.md, AGENTS.md)
  - Living design reference (docs/ARCHITECTURE.md)
  - Secret and artifact protection (.gitignore)
affects: [00-02-toolchain, 01-cicd-pipeline, 02-foundations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agent instructions split across CLAUDE.md (Claude Code) and AGENTS.md (cross-tool agents.md standard), written together to prevent factual divergence"
    - "Deep detail lives in one place and is cross-referenced, never duplicated across docs"
    - "Public-repo secret hygiene enforced by .gitignore, verified empirically rather than by inspection"

key-files:
  created: [CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md, .gitignore]
  modified: [.paul/STATE.md, .paul/ROADMAP.md, .paul/paul.toml, .paul/ledger.toml]

key-decisions:
  - "Scoped .gitignore's .claude/ rule to worktrees/ only, so .claude/settings.json stays tracked"
  - "Ordered broad .env* rules before !.env.example so git's last-matching-rule lets the negation win"
  - "Framed npm commands as 'planned' rather than working, since no package.json exists yet"
  - "Removed a self-added !**/public/**/*.key negation that re-allowed private keys under public/"

patterns-established:
  - "docs/ARCHITECTURE.md is the living design reference; .paul/ROADMAP.md is the authority on phase status"
  - "Never invent endpoint URLs for the unconfirmed Bulgarian fines/vignette services"

# Metrics
duration: 13min
started: 2026-08-07T12:08:29Z
completed: 2026-08-07T12:21:43Z
description: "Agent entry-point docs, architecture reference, and empirically-verified .gitignore secret protection for a public repo"
type: Summary
about: "gaspense"
---

# Phase 0 Plan 01: AI-Friendly Project Scaffolding Summary

**Any agent or contributor opening this repo now gets the stack, conventions, public-repo secret rules, and state-file locations from a single file — and a `.gitignore` proven by test to block real secrets while keeping `.env.example` trackable.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~13 min |
| Started | 2026-08-07T12:08:29Z |
| Completed | 2026-08-07T12:21:43Z |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 4 |
| Escalation statuses | DONE ×3 — no DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED |
| Checkpoints | None (autonomous plan) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Agent entry-point docs carry working context | **Pass** | Every required element (stack, commands, conventions, secret rules, state locations) grep-confirmed present in *both* CLAUDE.md and AGENTS.md — 12/12 markers each |
| AC-2: Architecture reference documents the real design | **Pass** | All 8 entities, all 9 route groups, all 7 phases individually confirmed against PROJECT.md and ROADMAP.md |
| AC-3: Secrets and local artifacts cannot be committed | **Pass** | Tested against a *real* `.env` and `node_modules/` — both ignored, plus `.claude/worktrees/`. `.env.example`, `.claude/settings.json`, `.paul/`, `projects/` all confirmed still trackable |
| AC-4: No broken internal references | **Pass** | All 15 relative markdown links resolved to existing files |

## Verification Results

- `test -f` on all four deliverables → present
- 12/12 required content markers present in each of CLAUDE.md and AGENTS.md, with no contradictions between them
- `git check-ignore -v` matched an explicit rule for `.env`, `node_modules`, `.claude/worktrees`, and (post-hardening) `.key` files at both root and `public/`
- Negative checks confirmed `.env.example`, `.claude/settings.json`, `.paul/PROJECT.md`, `projects/gaspense/PLANNING.md` are **not** ignored
- Secret/PII scan across all new files: no key-like strings (`sk-`, `ghp_`, `AIza`, JWT, PEM headers), no Bulgarian-plate-like patterns
- `git status --short` showed only the four intended new files; `.claude/worktrees/` correctly dropped out

## Accomplishments

- **Agent onboarding is now single-file.** A fresh agent reads CLAUDE.md (or AGENTS.md) and can state the stack, conventions, git workflow, and where PAUL state lives without opening anything else.
- **Secret protection is proven, not asserted.** The `.gitignore` was validated by creating an actual `.env` and `node_modules/` and confirming git ignored them — and by confirming the four must-stay-tracked paths were untouched.
- **The unconfirmed Bulgarian API is documented as unknown.** Both agent docs and `docs/ARCHITECTURE.md` explicitly instruct against inventing endpoint URLs, closing off a likely hallucination path in Phase 5.

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Tasks 1–3 (batched) | `5541d28` | docs | CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md, .gitignore |
| UNIFY hardening + summary | pending | docs | Removed `.key` negation hole, wrote this summary |

Plan metadata: `272fa62` (docs: create plan 00-01)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `CLAUDE.md` | Created | Claude Code operating instructions — stack, conventions, secret rules, git workflow, repo map |
| `AGENTS.md` | Created | Same context in the cross-tool agents.md standard (Cursor, Aider, Copilot) |
| `docs/ARCHITECTURE.md` | Created | Living design reference — system overview, 8 entities, 9 route groups, 7-phase roadmap, known unknowns |
| `.gitignore` | Created | Secrets (`.env*` with `!.env.example`), dependencies, build output, test output, local tooling, OS/editor cruft |
| `.paul/STATE.md` | Modified | Loop position, progress, boundaries, session continuity |
| `.paul/ROADMAP.md` | Modified | Milestone → In progress; Phase 0 → 2 plans listed |
| `.paul/paul.toml`, `.paul/ledger.toml` | Modified | Manifest sync and append-only session ledger |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Scope `.gitignore`'s `.claude/` rule to `worktrees/` only | `.claude/settings.json` is deliberately tracked (carries the repo's `bgIsolation` setting) | Ignoring `.claude/` wholesale would have silently untracked a committed file |
| Order broad `.env*` rules **before** `!.env.example` | Git applies last-matching-rule; a later broad ignore would make the negation dead | `.env.example` stays trackable as the public template — verified, not assumed |
| Frame npm commands as "planned", not working | No `package.json` exists until plan 00-02 | Prevents an agent failing on its first command; both docs tell readers to check `test -f package.json` first |
| Write CLAUDE.md and AGENTS.md in one pass | Two files describing the same project will diverge if written separately | Their stack/commands/workflow content is identical by construction |
| Cross-reference instead of duplicating README.md | README.md already carries the stack and data-model tables | Avoids four files restating the same tables and drifting on first change |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Closed a secret-exposure hole introduced during execution |
| Scope additions | 2 | Both strengthen the public-repo constraint; no feature creep |
| Process deviations | 1 | Cosmetic — commit granularity only |
| Deferred | 0 | — |

**Total impact:** No scope creep. One genuine self-inflicted risk found and fixed during reconciliation.

### Auto-fixed Issues

**1. [Security] `.gitignore` negation re-allowed private keys under `public/`**
- **Found during:** UNIFY reconciliation (re-reading the actual file rather than trusting the execution report)
- **Issue:** Task 3 was written with `!**/public/**/*.key`, an entry the plan never specified. It re-allowed any `.key` file under a `public/` directory to be committed — in a public repo, and in the exact directory Next.js serves statically.
- **Fix:** Removed the negation, leaving the blanket `*.key` ignore. A legitimately-public `.key` asset can still be forced with `git add -f`.
- **Files:** `.gitignore`
- **Verification:** Created `public/leak.key` and `root.key`; `git check-ignore -v` confirmed both match `*.key`. Re-ran the full AC-3 check afterward — still passing.

### Scope Additions

**1. `.gitignore` added to Phase 0 scope** (decided at PLAN time, user-approved)
- ROADMAP's original Phase 0 scope listed only CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md, and lint config.
- Added because PROJECT.md's public-repo constraint requires `.env*` ignored with only `.env.example` tracked — yet the repo had **no `.gitignore` at all**, and `.claude/worktrees/` was already sitting untracked. Deferring it would have left a window for committing a secret.

**2. Credential and log patterns beyond the plan's enumerated categories**
- Plan enumerated: secrets (`.env` variants), Node/Next, test/coverage, local tooling, OS/editor.
- Also added: `*.pem`, `*.key`, `secrets.json`, `service-account*.json`, log patterns, and yarn/pnp entries.
- Justified as a direct extension of the "secrets" and "dependencies" categories for a public repo. Noted here rather than silently absorbed.

### Process Deviations

**1. Tasks 1–3 committed as one commit rather than atomically per task**
- The SUMMARY template's Task Commits table assumes one commit per task.
- All three tasks were documentation/config with no independent build state, so a single coherent commit was used. Cosmetic only; no effect on reconciliation. Worth doing atomically in code phases where bisecting matters.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Phase-completion heuristic gave a false positive | The workflow detects "last plan in phase" by comparing PLAN vs SUMMARY file counts. With only `00-01-PLAN.md` on disk, counts match at 1=1 after this summary — which would trigger the mandatory phase transition. Overridden: ROADMAP.md (the documented authority on phase status) lists **2** plans for Phase 0, and 00-02's lint/format config is a stated Phase 0 deliverable that does not exist. Transition deliberately **not** run. |

## Next Phase Readiness

**Ready:**
- Agent onboarding docs, design reference, and secret protection all in place and verified
- `.paul/` state, ROADMAP, PROJECT, and manifest are mutually consistent
- Plan 00-02's scope is already decided (minimal `package.json` with lint/format devDependencies only; Next.js layered on in Phase 2)

**Concerns:**
- **Doc drift risk.** `README.md`, `docs/ARCHITECTURE.md`, and the two agent files all touch the data model. Cross-referencing mitigates it, but when Phase 2 builds the real schema, `docs/ARCHITECTURE.md` must be updated as the living doc or it becomes actively misleading.
- **CLAUDE.md and AGENTS.md duplicate each other by design** (two competing standards). They must always be edited together; editing one alone will silently diverge the guidance agents receive.
- **The "planned" npm commands are aspirational.** If plan 00-02 or Phase 2 names scripts differently, both agent docs need updating in the same commit.

**Blockers:** None.

**Phase 0 is NOT complete.** Plan 00-02 (minimal `package.json`, ESLint, Prettier, EditorConfig, markdownlint, and the CI-callable check script that Phase 1's GitHub Actions will invoke) remains before the phase's own acceptance — a working docs/lint gate — is met.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 00-ai-friendly-scaffolding, Plan: 01*
*Completed: 2026-08-07*
