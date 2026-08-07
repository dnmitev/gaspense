---
phase: 01-cicd-pipeline
plan: 01
subsystem: infra
tags: [github-actions, ci, git-hooks, secret-scanning, node-lts]

# Dependency graph
requires:
  - phase: 00-02
    provides: "`npm run check` — the single gate command CI and the hook both invoke"
provides:
  - GitHub Actions CI gate on pushes to main and PRs to main
  - Version-controlled pre-push hook, auto-activated by npm install
  - Verified secret-scanning posture (scanning + push protection enabled)
affects: [02-foundations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI is proven in both directions — a green run is not accepted as proof without a matching red run"
    - "Destructive verification happens on a throwaway branch, never on main"
    - "Runtime versions are checked against the upstream release schedule, not assumed from the plan"

key-files:
  created: [.github/workflows/ci.yml, .githooks/pre-push]
  modified: [package.json, CLAUDE.md, AGENTS.md]

key-decisions:
  - "CI triggers on push to main, not only pull_request — a PR-only workflow would never fire under this project's direct-to-main flow"
  - "Node 22, not the planned 20: Node 20 reached end-of-life 2026-04-30, so CI would have validated an unsupported runtime"
  - "actions/checkout and actions/setup-node bumped v4 -> v7, clearing a per-run Node 20 deprecation annotation"
  - "No branch protection — required checks would block the authorised direct-push flow; the local hook fills that gap instead"
  - "Non-provider secret scanning recorded as infeasible, not skipped — the feature is absent from this repo tier"

patterns-established:
  - "`npm install` activates git hooks via the `prepare` script; no manual git config on a fresh clone"
  - "Phase 2 adds build/test steps to the existing workflow rather than creating a new one"

# Metrics
duration: 29min
started: 2026-08-07T12:55:43Z
completed: 2026-08-07T13:24:47Z
description: "CI gate proven to both pass and fail, plus a pre-push hook that aborts real pushes before they reach GitHub"
type: Summary
about: "gaspense"
---

# Phase 1 Plan 01: CI/CD Pipeline Summary

**Every push to `main` now runs the check gate in GitHub Actions — and the pipeline is proven to fail, not merely to pass — with a version-controlled pre-push hook catching problems before they ever reach GitHub.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~29 min |
| Started | 2026-08-07T12:55:43Z |
| Completed | 2026-08-07T13:24:47Z |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 2 |
| Files modified | 3 |
| Escalation statuses | DONE ×2, DONE_WITH_CONCERNS ×1 (AC-4 sub-item infeasible) |
| Checkpoints | None (autonomous plan) |
| Commits | 5 (`bcd398e`, `a775125`, `39d2e08`, `398d2bf`, `04718f8`) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: CI runs and passes on a direct push to `main` | **Pass** | Real run `31181340683` — all steps ✓ in 11s, conclusion `success` |
| AC-2: CI actually fails when the gate fails | **Pass** | Run `31181495296` on the probe branch concluded `failure`; install steps passed and `Run check gate` failed with exit code 1 |
| AC-3: Pre-push hook blocks failing pushes, version-controlled | **Pass** | Real `git push` refused ("failed to push some refs"); hook exits 1 on violation and 0 when clean; `core.hooksPath` went from unset to `.githooks` purely via `npm install` |
| AC-4: Secret scanning hardened and verified | **Partial (2 of 3)** | `secret_scanning` ✓ enabled, `secret_scanning_push_protection` ✓ enabled, `secret_scanning_non_provider_patterns` ✗ **infeasible** — see Deviations |
| AC-5: Pipeline documented consistently in both agent files | **Pass** | Identical 14-line `## CI and Quality Gates` section in CLAUDE.md and AGENTS.md, byte-for-byte |

## Verification Results

- `gh run watch --exit-status` on the main-branch run: every step ✓, no annotations after the actions bump
- Probe run conclusion queried via API before cleanup: `{"conclusion":"failure"}`
- Cleanup verified, not assumed: 0 open PRs, probe branch absent locally *and* remotely, **0 probe commits on `origin/main`**, working tree clean
- Hook exit codes measured without a pipe (see Issues): 1 with a violation, 0 when clean
- Final security posture confirmed by API: scanning `enabled`, push protection `enabled`
- `npm run check` green throughout; the hook itself gated three of this plan's five pushes
- No secrets or PII introduced in `ci.yml` or `pre-push`

## Accomplishments

- **The pipeline is trustworthy because it was falsified, not just confirmed.** A CI that has only ever passed is indistinguishable from a CI that cannot fail; this one was observed failing at the precise intended step, on a branch that was then erased.
- **CI actually fires for this project's real workflow.** The roadmap said "on every PR", but this repo commits directly to `main` and opens no PRs — a `pull_request`-only trigger would have produced a pipeline that never ran once. Caught at plan time by reading PROJECT.md's git-workflow decision.
- **A pre-landing gate exists despite having no branch protection.** Direct-to-main means CI is inherently post-hoc; the hook restores the catch-it-first property without constraining the authorised push flow.
- **CI tests a supported runtime.** The plan's Node 20 pin was checked against the upstream release schedule and found to be EOL.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `.github/workflows/ci.yml` | Created | CI gate: `npm ci` + `npm run check` on push/PR to `main`; least-privilege token, concurrency cancellation, 10-min timeout |
| `.githooks/pre-push` | Created | Runs the same gate locally; clear failure message naming the `--no-verify` bypass; helpful error when `node_modules` is absent |
| `package.json` | Modified | Added `prepare` script (activates hooks); raised `engines.node` to `>=22` |
| `CLAUDE.md`, `AGENTS.md` | Modified | Added identical `## CI and Quality Gates` sections |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Trigger CI on `push` to `main`, not PR-only | This project commits directly to `main`; a PR-only workflow would never execute | The gate actually runs; PR trigger retained for occasional PRs and used for the failure test |
| Node 22 instead of the planned 20 | Node 20 reached EOL 2026-04-30 per the nodejs/Release schedule; today is 2026-08-07 | CI validates a supported runtime; `engines` no longer makes a stale claim |
| Bump actions `v4` → `v7` | GitHub was annotating every run with a Node 20 deprecation warning | Clean runs; annotations stay meaningful instead of becoming background noise |
| No branch protection | Required status checks would block the authorised direct-push workflow | The local hook is the pre-landing gate instead — documented as such in both agent files |
| Test the failure path on a throwaway branch | `main` must never receive a deliberately broken commit | Proof obtained with zero pollution of `main`'s history |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Corrected an EOL runtime the plan specified |
| Infeasible (AC not fully met) | 1 | Feature absent from this repo tier; deferred with reason |
| Plan-spec flaws found | 1 | A verify command that could never pass; worked around |
| Deferred | 1 | Non-provider scanning |

**Total impact:** No scope creep. One plan error corrected, one plan assumption disproved.

### Auto-fixed Issues

**1. [Correctness] The plan pinned CI to an End-of-Life Node version**
- **Found during:** Task 1 qualify — GitHub emitted a Node 20 deprecation annotation on the first green run
- **Issue:** The plan specified `node-version: 20` with the rationale "test the oldest supported runtime". Checking the upstream `nodejs/Release` schedule showed v20 maintenance ended **2026-04-30** — it is not a supported runtime at all, so `engines: ">=20"` was also a stale claim.
- **Fix:** CI and `engines` both moved to Node 22 (LTS until 2027-04-30); actions bumped `v4` → `v7` after confirming the tags exist rather than guessing version numbers.
- **Verification:** Second green run in 11s with the annotation gone.

### Infeasible — AC-4 Not Fully Met

**Non-provider secret-scanning patterns cannot be enabled on this repository.**

- **Attempted:** `PATCH /repos/dnmitev/gaspense` with `security_and_analysis.secret_scanning_non_provider_patterns.status=enabled`, twice, with the full response inspected.
- **Observed:** HTTP 200 and `"permissions":{"admin":true}`, yet the field remained `disabled`. The API silently ignores it — no error to react to.
- **Root cause:** confirmed by the repository's own settings page, which offers only *Secret Protection* (partner-pattern alerts) and *Push protection* — both already enabled. There is no non-provider-patterns toggle. The feature belongs to GitHub's paid Secret Protection tier, not the free public-repo feature set.
- **Resolution:** recorded as **infeasible**, deliberately not as "skipped". The distinction matters: if this repo ever moves to an organisation with that licensing, the item becomes actionable. Logged to STATE.md Deferred Issues.
- **Net security posture unchanged from Phase 1's actual declared scope:** secret scanning and push protection are both active, and both were already on by GitHub's public-repo default.

### Plan-Spec Flaws Found

**1. Task 3's verify command could never have passed.**
It compared the CI sections with
`diff <(sed -n '/## CI and Quality Gates/,/^## /p' CLAUDE.md) <(... AGENTS.md)`.
A `sed` range ending on `/^## /` includes the *following* heading line — and those differ by
design (`## Conventions` vs `## Code Conventions`), so the diff would always report a difference.
Replaced with an `awk` extraction of the section body only, which correctly showed the two
sections byte-identical. The work was right; the check was wrong.

### Deferred Items

- **Non-provider secret-scanning patterns** — infeasible on this repo tier (above). Revisit only under org licensing.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| My first hook test reported a false negative | I piped the hook into `tail`, so the `if` evaluated `tail`'s exit status rather than the hook's, and reported "hook passed with a violation" while the hook had in fact printed its abort message. The hook was correct; the test was wrong. Re-measured without the pipe: exit 1 on violation, exit 0 when clean. |
| `gh api` reported success for a setting it silently ignored | Suppressing the response body hid this. Re-ran with the response visible, which proved the field was unchanged despite HTTP 200 — leading to the root-cause finding above. Lesson recorded: never confirm a remote state change from an exit code alone; re-query it. |
| `PIPESTATUS` echoed empty in several checks | Cosmetic reporting artefact in my own verification scripts, not a product defect; the underlying git/gh errors were unambiguous. |

## Next Phase Readiness

**Ready:**
- A working, falsified CI workflow that Phase 2 extends with `build` and `test` steps rather than replacing
- `package-lock.json` + `npm ci` + npm caching already wired
- Pre-push hook active and self-installing, so Phase 2's larger test suite is enforced locally too
- Secret scanning and push protection confirmed active before any credentials enter the picture

**Concerns:**
- **PROJECT.md's CI metric is only partly met.** It reads "lint + test + build pass on every PR"; only lint exists. Marked partially achieved at this transition, to be completed in Phase 2.
- **Three artefacts must change together in Phase 2:** `ci.yml` (add build/test steps), and the "Not available yet"/"No `test` or `build` step in CI yet" wording in *both* CLAUDE.md and AGENTS.md. Missing one leaves agents with contradictory instructions.
- **The hook is bypassable** (`--no-verify`, by design) and there is no branch protection, so a determined or careless push can still land red on `main`. CI catches it after the fact; that is the accepted trade-off of direct-to-main.
- **Node 22 reaches EOL 2027-04-30.** The same staleness that affected Node 20 will recur; worth a periodic check rather than a surprise.
- **`engines.node >= 22` may need raising** if Phase 2's Next.js version demands newer; keep it and the CI matrix aligned.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 01-cicd-pipeline, Plan: 01*
*Completed: 2026-08-07*
