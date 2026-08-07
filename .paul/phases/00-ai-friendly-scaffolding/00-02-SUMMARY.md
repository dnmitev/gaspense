---
phase: 00-ai-friendly-scaffolding
plan: 02
subsystem: infra
tags: [eslint, prettier, markdownlint, editorconfig, npm, tooling, ci-gate]

# Dependency graph
requires:
  - phase: 00-01
    provides: The agent docs (CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md) that this plan lints and gates
provides:
  - npm project with lint/format toolchain (devDependencies only)
  - ESLint flat config on a typescript-eslint base, extensible for Next.js
  - Prettier as formatter of record, plus EditorConfig
  - markdownlint structural rules scoped to human-authored docs
  - "`npm run check` — the single CI-callable gate for docs presence + style"
affects: [01-cicd-pipeline, 02-foundations]

# Tech tracking
tech-stack:
  added:
    [eslint, "@eslint/js", typescript-eslint, typescript, prettier, eslint-config-prettier, markdownlint-cli2]
  patterns:
    - "Tool-overlap conflicts resolved empirically by running one tool's output through the other, never by guessing a disable-list"
    - "`npm run check` is the single aggregate gate; CI calls one command, not four"
    - "Protected paths (.paul/, projects/, .claude/) excluded from every formatter and linter"

key-files:
  created:
    [package.json, package-lock.json, eslint.config.mjs, .prettierrc.json, .prettierignore, .editorconfig, .markdownlint-cli2.jsonc, scripts/check-docs.sh]
  modified: [CLAUDE.md, AGENTS.md, docs/ARCHITECTURE.md, README.md]

key-decisions:
  - "Only MD013 disabled — verified empirically that Prettier's table style satisfies MD060 and that Prettier fixes MD022 itself"
  - "Added .claude/ to .prettierignore because prettier --write would have rewritten the protected .claude/settings.json"
  - "license set to UNLICENSED + private:true rather than npm init's ISC default, to avoid an unconsidered open-source grant on a public repo"
  - "No test script — a no-op passing one would give Phase 1 CI a false green"

patterns-established:
  - "`npm run check` before committing; Phase 1 CI runs the same command"
  - "ESLint TS rules are scoped to **/*.{ts,tsx} and must not fail when no sources exist"

# Metrics
duration: 9min
started: 2026-08-07T12:29:29Z
completed: 2026-08-07T12:43:04Z
description: "npm lint/format toolchain with a verified npm run check gate that fails by name when agent docs go missing"
type: Summary
about: "gaspense"
---

# Phase 0 Plan 02: Lint/Format Toolchain and Check Gate Summary

**Phase 1's CI now has one concrete command to run: `npm run check` verifies the agent docs exist, then enforces Prettier, ESLint, and markdownlint — proven to fail by name when a doc goes missing.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~9 min |
| Started | 2026-08-07T12:29:29Z |
| Completed | 2026-08-07T12:43:04Z |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 8 |
| Files modified | 4 |
| devDependencies | 7 (172 packages, 0 vulnerabilities) |
| Escalation statuses | DONE ×3 — no DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED |
| Checkpoints | None (autonomous plan) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: npm toolchain, no runtime dependencies | **Pass** | Node assertion confirms zero `dependencies`, all five scripts present, and no `test` placeholder |
| AC-2: ESLint clean and TypeScript-ready | **Pass** | Proven non-vacuous — ESLint reports 1 file actually linted, and a probe `.ts` file triggered `@typescript-eslint/no-unused-vars` + `prefer-const` (3 errors), confirming TS rules are live despite no sources existing |
| AC-3: Prettier and markdownlint agree; protected files untouched | **Pass** | Both exit 0 on identical content; `git status` confirms `.paul/`, `projects/`, `.claude/` byte-identical after a formatter run |
| AC-4: One check command gates docs and style, fails loudly | **Pass** | `npm run check` exits 0; removing `CLAUDE.md` produced a non-zero exit naming that exact file, then passed again on restore |

## Verification Results

- `npm run check` → exit 0: `check-docs: OK — all 3 required documentation files present`, Prettier "All matched files use Prettier code style!", markdownlint "0 issues in 0 files" across 4 linted files
- Negative test: `mv CLAUDE.md /tmp/` → `check-docs: MISSING required documentation file: CLAUDE.md` + `FAILED — 1 required documentation file(s) missing`, non-zero exit; restored and green again
- `scripts/check-docs.sh` verified to work from an unrelated cwd (it resolves the repo root from its own location)
- ESLint probe: temporary `src/tmp-probe.ts` produced 3 errors from TS-specific rules, then was removed
- Secret/PII scan across all created and modified files: no key-like strings, no plate-like patterns
- `git check-ignore` confirms `node_modules` stays out of git

## Accomplishments

- **Phase 1 is unblocked with a single command.** Rather than leaving CI to orchestrate four tools, `npm run check` is one gate covering docs presence, formatting, code lint, and markdown lint.
- **Lint rules exist before any application code.** The typescript-eslint base is live and proven to fire on TS files, so the first code written in Phase 2 conforms to rules that already exist — the stated rationale for Phase 0.
- **Tool conflict resolved with evidence instead of guesswork.** See Decisions below; this avoided silently disabling two rules that actually work.

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Tasks 1–3 (batched) | `9d3f63e` | docs | npm toolchain, four configs, check-docs.sh, agent-doc command tables |
| UNIFY + phase transition | pending | feat | This summary, PROJECT.md evolution, ROADMAP closure |

Plan metadata: `f4e03cd` (docs: create plan 00-02)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `package.json` | Created | npm project — devDependencies only, five scripts, `private: true` |
| `package-lock.json` | Created | Reproducible installs for CI |
| `eslint.config.mjs` | Created | Flat config, typescript-eslint base, `eslint-config-prettier` last |
| `.prettierrc.json` | Created | Explicit formatter settings (printWidth 100, LF, double quotes) |
| `.prettierignore` | Created | Excludes `.paul/`, `projects/`, `.claude/`, lockfile, build output |
| `.editorconfig` | Created | Editor-level UTF-8/LF/final-newline/2-space consistency |
| `.markdownlint-cli2.jsonc` | Created | Structural rules for human-authored docs; documents why MD013 is the sole exclusion |
| `scripts/check-docs.sh` | Created | Dependency-free docs-presence gate, executable, cwd-independent |
| `CLAUDE.md`, `AGENTS.md` | Modified | Commands tables now list real commands plus a "not available yet" section; Prettier formatting |
| `docs/ARCHITECTURE.md` | Modified | Prettier formatting; `text` language added to two ASCII-diagram fences |
| `README.md` | Modified | Prettier formatting only |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Disable only MD013 | Ran Prettier's own output through markdownlint: its padded-pipe tables satisfy MD060, and Prettier fixes MD022 itself. Only line-length genuinely conflicts. | Two working rules stay enabled that a guessed disable-list would have switched off |
| Add `.claude/` to `.prettierignore` | `prettier --write` had `.claude/settings.local.json` in its target set and would have rewritten the protected `.claude/settings.json` | Boundary preserved; caught before any write ran |
| `license: UNLICENSED` + `private: true` | `npm init` defaults to ISC. On a **public** repo that is an unconsidered open-source grant. | Conservative and reversible — but the real licence choice is still open (see Deferred) |
| No `test` script | Nothing to test yet; a passing no-op would make Phase 1 CI report green on zero coverage | Phase 2 adds the real one |
| `engines.node >= 20` | CI, Vercel, and local dev should agree on a floor | Prevents version drift between environments |
| Scope ESLint TS rules to `**/*.{ts,tsx}` | Config must not error merely because no sources exist yet | Phase 2 appends the Next.js preset without restructuring |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 2 | Both removed generated cruft the plan explicitly warned about |
| Scope additions | 2 | One protected a boundary; one fixed a real lint violation |
| Findings better than planned | 1 | Fewer rules disabled than anticipated |
| Deferred | 1 | Licence choice logged for the user |

**Total impact:** No scope creep. One boundary risk caught before it landed.

### Auto-fixed Issues

**1. [Cruft] `npm init -y` generated a failing `test` script**
- **Found during:** Task 1
- **Issue:** Default `"test": "echo \"Error: no test specified\" && exit 1"` — directly contradicts the plan's "no test script" instruction and would break any future CI that calls `npm test`.
- **Fix:** Removed. Task 1's verify asserts its absence.

**2. [Cruft] `"main": "index.js"` pointed at a nonexistent file**
- **Found during:** Task 1
- **Issue:** npm's default entry point, with no such file in the repo. The plan's action explicitly warned about this.
- **Fix:** Removed; verified absent.

### Scope Additions

**1. `.claude/` added to `.prettierignore`** (not in the plan's enumerated ignore list)
- Prettier's first `--check` run flagged `.claude/settings.local.json`, which meant `prettier --write` would also have rewritten `.claude/settings.json` — an explicit boundary in this plan and a file 00-01 deliberately committed.
- Excluded `.claude/` entirely before running any write. Verified afterward that `git status` shows no `.claude/` modification.

**2. `text` language added to two code fences in `docs/ARCHITECTURE.md`**
- MD040/fenced-code-language flagged the two ASCII diagrams (system overview, entity relationships) for having bare fences.
- Prettier does not fix this, so it was a genuine structural violation rather than a formatting one. The plan authorised "formatting-only edits" to that file, so this is noted rather than silently absorbed. Content unchanged — only the fence info-string.

### Findings Better Than Planned

**Markdownlint conflicts were narrower than expected.** The plan anticipated disabling several Prettier-conflicting rules and instructed determining them empirically. The empirical result was that **only MD013** conflicts — Prettier's table output satisfies MD060, and Prettier repairs MD022 (blanks-around-headings) on its own. Following the plan's "do not guess a rule list" instruction directly prevented over-disabling.

### Deferred Items

- **Licence choice unsettled.** `UNLICENSED` was chosen to avoid npm's accidental ISG/ISC grant on a public repo. If the project should carry a real open-source licence (MIT, Apache-2.0) or an explicit "all rights reserved", that is the user's call — logged to STATE.md.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Task 2's verify command included `prettier --check .`, which cannot pass until the docs are formatted — nominally Task 3's job | Not a real blocker: Task 2's own `<action>` instructs running both tools to discover conflicts empirically, which authorises the `--write`. Noted as a minor task-boundary ambiguity in the plan, not a spec error. |

## Next Phase Readiness

**Ready:**
- `npm run check` is a single, proven command for Phase 1's GitHub Actions to invoke
- `package-lock.json` exists, so CI can use `npm ci` with dependency caching
- ESLint is structured for Phase 2 to append the Next.js flat preset without a rewrite
- Phase 0 is complete — both plans closed

**Concerns:**
- **Phase 1's CI will be lint/docs-only at first.** Phase 1's declared scope says "lint + unit/integration tests + build", but there is deliberately no test framework and no build until Phase 2. Phase 1's workflow must be written to pass with what exists and pick up `build`/`test` steps when Phase 2 lands — otherwise it will fail on day one.
- **Command tables in CLAUDE.md/AGENTS.md now assert commands exist.** When Phase 2 adds `dev`/`build`/`test`, both files must move those rows out of "not available yet" — in the same commit, per the 00-01 decision that they never diverge.
- **`docs/ARCHITECTURE.md` still describes an unbuilt schema.** It must be updated when Phase 2 creates the real tables, or it becomes actively misleading.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 00-ai-friendly-scaffolding, Plan: 02*
*Completed: 2026-08-07*
