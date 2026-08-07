---
phase: 02-foundations
plan: 01
subsystem: infra
tags: [nextjs, react, tailwind, eslint, app-router, build-gate]

# Dependency graph
requires:
  - phase: 01-01
    provides: The CI workflow this plan extends with a build step
provides:
  - Next.js 16 App Router application shell that builds and serves
  - eslint-config-next merged into the flat config, with React/hooks/a11y rules proven active
  - Tailwind 4 (CSS-first) styling pipeline
  - "`dev` and `build` scripts, and a Build step in CI"
affects: [02-02, 02-03, 02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added:
    [next@16, react@19, react-dom@19, tailwindcss@4, "@tailwindcss/postcss", postcss, eslint-config-next@16, "@types/node", "@types/react", "@types/react-dom"]
  patterns:
    - "Scaffold by installing dependencies and writing files directly — never create-next-app in a non-empty repo"
    - "Read the installed package's actual exports before writing config; version assumptions are the main failure mode here"
    - "Lint rules are proven active by probe file, never inferred from a green run"

key-files:
  created:
    [app/layout.tsx, app/page.tsx, app/globals.css, tsconfig.json, next.config.ts, postcss.config.mjs]
  modified: [package.json, eslint.config.mjs, .github/workflows/ci.yml, .markdownlint-cli2.jsonc, AGENTS.md]

key-decisions:
  - "ESLint pinned to 9, reversing Phase 0's 10 — eslint-config-next's bundled plugins cap at ^9 and crash 10 at rule-load time"
  - "Kept jsx-a11y by downgrading rather than using @next/eslint-plugin-next alone, because the WCAG AA metric depends on it"
  - "Commit Next 16's generated AGENTS.md block rather than fight it; MD025 disabled as a consequence"
  - "Tailwind 4 needs no tailwind.config.js — theme customisation lives in app/globals.css"

patterns-established:
  - "Next auto-patches tsconfig.json on build; verified it does not fight Prettier's formatting"
  - "Protected-file diffs are checked against the pre-plan commit, not an older phase boundary"

# Metrics
duration: 33min
started: 2026-08-07T14:11:32Z
completed: 2026-08-07T14:44:27Z
description: "Next.js 16 App Router shell building and serving, with Next lint rules proven active and a build gate in CI"
type: Summary
about: "gaspense"
---

# Phase 2 Plan 01: Next.js Scaffold Summary

**The application now exists: Next.js 16 + React 19 + Tailwind 4 builds, serves HTTP 200, and is build-gated in CI — added to a non-empty repo without disturbing a single Phase 0/1 artefact that wasn't explicitly waived.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~33 min |
| Started | 2026-08-07T14:11:32Z |
| Completed | 2026-08-07T14:44:27Z |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 6 |
| Files modified | 5 |
| Escalation statuses | DONE ×2, DONE_WITH_CONCERNS ×1 (boundary conflict, escalated and waived) |
| Checkpoints | None pre-planned; one unplanned boundary escalation to the user |
| CI | green with `check` + `Build` in 32s |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------------|-------|
| AC-1: App builds and serves a page | **Pass** | `npm run build` compiled 3 static routes; dev server returned HTTP 200 with `<title>Gaspense</title>` |
| AC-2: Existing gate still passes over app code | **Pass** | `npm run check` green; four rule families proven firing on a probe; `eslint-config-prettier` still last; ignores intact |
| AC-3: CI gains a build step and stays green | **Pass** | Run `31188382467` — `Run check gate` ✓ then `Build` ✓, conclusion `success` |
| AC-4: No Phase 0/1 artefact clobbered | **Partial (waived)** | 7 of 9 protected files verified byte-identical. `AGENTS.md` modified by Next.js itself; `.markdownlint-cli2.jsonc` modified under an explicitly granted waiver |

## Verification Results

- `npm run build`: compiled successfully, 3 routes prerendered static
- Dev server: HTTP 200, page contains "Gaspense", `<title>` correct — then stopped cleanly
- **Lint rules proven live, not inferred:** a probe file triggered `@next/next/no-img-element`, `jsx-a11y/alt-text`, `react-hooks/purity`, and `react-hooks/rules-of-hooks`; probe exited 1 and was deleted
- **Prettier↔Next tsconfig ping-pong tested and ruled out:** formatted `tsconfig.json` with Prettier, rebuilt, and confirmed the file hash was unchanged — Next only rewrites when values change, not formatting
- **AGENTS.md regeneration claim tested rather than trusted:** deleted the block, ran `next dev`, watched it reappear
- Protected-file diff against the correct pre-plan baseline (`872074f`): `README.md`, `CLAUDE.md`, `.gitignore`, `.claude/settings.json`, `.prettierrc.json`, `scripts/check-docs.sh`, `.githooks/pre-push` all untouched
- `npm ls eslint`: 0 invalid peers after the downgrade (4 before)
- Working tree clean; no stray changes under `.paul/`, `projects/`, `.claude/`

## Accomplishments

- **The scaffold landed without collateral damage.** `create-next-app` would have overwritten `README.md`, `.gitignore`, `eslint.config.mjs`, and the `package.json` scripts; installing and writing files directly avoided that entirely, and the diff proves it.
- **Caught a broken lint gate that reported success.** ESLint 10 crashed at rule-load time; the exit code was 2, but a piped check initially masked it. Had this shipped, `npm run check` would have been silently non-functional over all application code for the rest of the project.
- **Accessibility linting preserved.** The cheaper fix (drop the incompatible bundle, keep ESLint 10) would have silently removed `jsx-a11y` — the exact rule set PROJECT.md's WCAG AA metric relies on.
- **Both "read, don't assume" instructions paid off.** The flat-config entry point and the Tailwind major version were each different from what a reasonable guess would have produced.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `app/layout.tsx` | Created | Root layout, metadata, mobile-first viewport |
| `app/page.tsx` | Created | Deliberately minimal placeholder — no feature UI |
| `app/globals.css` | Created | Tailwind 4 CSS-first entry point |
| `tsconfig.json` | Created | Strict TS config; Next auto-patched `jsx` and a types include on first build |
| `next.config.ts` | Created | Minimal typed config, no experimental flags |
| `postcss.config.mjs` | Created | Tailwind 4 PostCSS plugin |
| `package.json` | Modified | `dev`/`build` scripts; Next/React runtime deps; ESLint pinned to 9 |
| `eslint.config.mjs` | Modified | `...next` spread in before `prettier` |
| `.github/workflows/ci.yml` | Modified | Added `Build` step after the check gate |
| `.markdownlint-cli2.jsonc` | Modified | MD025 disabled, with the reason and generator path recorded (waived) |
| `AGENTS.md` | Modified | Next.js 16's generated agent-rules block (written by the framework, not by hand) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| ESLint 10 → 9 | `eslint-config-next@16` declares `eslint >=9`, but its bundled react/import/jsx-a11y/react-hooks plugins all cap at `^9` and crashed ESLint 10 (`contextOrFilename.getFilename is not a function`). npm flagged 4 invalid peers. | **ESLint is frozen at 9 until those plugins support 10.** Recorded in STATE and PROJECT decisions |
| Downgrade rather than use `@next/eslint-plugin-next` alone | The narrow alternative kept ESLint 10 but dropped `jsx-a11y` and `react-hooks` | Accessibility and hooks-correctness linting retained |
| Commit Next's AGENTS.md block | Verified it regenerates on every `next dev`; removing it only creates a permanently dirty tree | The "CLAUDE.md and AGENTS.md always edited together" rule now has an externally-managed exception |
| Disable MD025 only | Next's block injects a second H1, making the rule unsatisfiable for that file. Narrower than excluding AGENTS.md from markdownlint | All other structural rules stay enforced |
| Keep Next's tsconfig auto-patch | `jsx: react-jsx` is mandatory for Next's automatic runtime | Verified it does not fight Prettier |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Spec assumption disproved | 1 | ESLint version incompatibility the plan could not have known |
| Boundary conflicts escalated | 2 | Both waived by the user rather than resolved unilaterally |
| Plan-spec flaws found | 1 | A verify command that would have falsely failed AC-4 |
| Auto-accepted tool changes | 1 | Next's tsconfig patch |

**Total impact:** No scope creep. One latent gate failure caught before it could hide real problems.

### Spec Assumption Disproved

**ESLint 10 is incompatible with `eslint-config-next@16`'s plugin bundle.**
The plan said to integrate `eslint-config-next` and "fix the code" if rules fire. Neither applied — ESLint
crashed loading `react/display-name` before linting anything. Diagnosis was evidence-based rather than
speculative: true exit code (2, initially masked by a pipe), the config's declared peer range (`>=9.0.0`,
optimistic), the bundled plugin ranges (all capped at `^9`), and npm's own `invalid` markers on four
packages. Resolved by downgrading ESLint and `@eslint/js` to `^9`, which cleared all four invalid peers.

### Boundary Conflicts (Escalated, Not Rationalised)

Two of this plan's own boundaries became unsatisfiable mid-execution. Per the apply-phase rule that a
boundary conflict means stop and report, both were escalated rather than quietly edited:

1. **`AGENTS.md` was declared off-limits** (doc updates deferred to 02-02), but Next.js 16 writes to it
   unavoidably via `generate-agent-files.js`.
2. **`.markdownlint-cli2.jsonc` was declared "settled, not retuned"**, but Next's injected H1 trips MD025
   and only that config can suppress it.

The user granted a waiver for the narrow fix (commit the block, disable MD025 only). AC-4 is therefore
recorded as **partial by waiver** rather than passed — the seven other protected files were verified
untouched.

### Plan-Spec Flaws Found

**Task 3's verify used the wrong diff baseline.** It hardcoded `git diff 1093e60..HEAD` — the Phase 0
completion commit — to prove protected files were untouched. But Phase 1 legitimately modified
`CLAUDE.md`, `AGENTS.md`, and `ci.yml` after that point, so the check would have reported three false
violations. Used `872074f` (the actual pre-plan HEAD) instead. This is the second plan whose verify
command was subtly wrong while the work itself was sound.

### Auto-Accepted Tool Changes

**Next rewrote `tsconfig.json` on first build** — setting `jsx: react-jsx` (mandatory for its automatic
runtime) and adding `.next/dev/types/**/*.ts` to `include`. Kept as legitimate, after testing that
Prettier and Next do not fight over the file.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `eslint .` appeared to exit 0 while crashing | The exit code was read through a pipe again, so it reported `tail`'s status. Same trap as plan 01-01. Re-measured directly: exit 2. **Worth a standing habit: never read an exit code through a pipe.** |
| `npm run check` failed after the probe cleanup, on a file I had not touched | Traced to MD025 in `AGENTS.md` — Next had injected its block during the earlier `next dev` verification. Led to the boundary escalation above. |
| `require('eslint-config-next/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED` | The package restricts subpath exports. Inspected the default export via dynamic `import()` instead, which answered the question directly. |

## Next Phase Readiness

**Ready:**
- A building, serving Next.js app for plans 02-02 through 02-06 to extend
- CI gates `check` + `build`; 02-02 adds the `test` step to a workflow already proven to fail correctly
- ESLint now covers application code with React, hooks, and a11y rules verified active

**Concerns:**
- **The agent docs are currently wrong, by design.** `CLAUDE.md` and `AGENTS.md` still list `npm run dev`
  and `npm run build` under "Not available yet" — both now exist. Doc updates were deliberately deferred
  to 02-02 so both files change once, together, but until then an agent reading them will be misinformed.
  **This is 02-02's first obligation.**
- **ESLint is frozen at 9.** A future dependency bump that requires ESLint 10 will collide with
  `eslint-config-next`. Revisit only when its bundled plugins declare 10 support.
- **Next.js owns a section of `AGENTS.md`.** Any future edit must leave the `nextjs-agent-rules` block
  alone; hand-editing inside it will be silently overwritten.
- **`docs/ARCHITECTURE.md` still describes an unbuilt schema** — 02-03's obligation when Prisma lands.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 02-foundations, Plan: 01*
*Completed: 2026-08-07*
