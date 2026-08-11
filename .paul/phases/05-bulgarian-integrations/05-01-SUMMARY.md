---
phase: 05-bulgarian-integrations
plan: 01
subsystem: api
tags: [vignette, bgtoll, external-service, driver-seam, rate-limit, cooldown, isolation]

requires:
  - phase: 05-bulgarian-integrations
    provides: The discovery that established the endpoint, its shapes, and its traps
  - phase: 04-pwa-mobile-ux
    provides: The driver-seam and test-safety pattern from 04-04, applied here before it could bite
provides:
  - Per-car Bulgarian vignette status on /cars, refreshable in one tap
  - lib/vignette.ts — a body-first client that never confuses "none" with "unavailable"
  - VignetteCheck — a check log whose latest row is the current state
  - A cooldown that doubles as the rate limit, enforced in the action
  - A stub driver the suites force, so no test calls a government endpoint
  - npm run verify:vignette — repeatable real-service verification
affects: [05-02 fines, which reuses the body-first parsing and the seam]

tech-stack:
  added: []
  patterns:
    - "Parse the body, never the HTTP status, for services that answer 200 for everything"
    - "A definite negative and an unavailable service are different results, never merged"
    - "A stored timestamp as the rate limit, rather than a counter a serverless process cannot share"

key-files:
  created:
    - lib/vignette.ts
    - lib/vignette-stub.ts
    - lib/vignette-checks.ts
    - scripts/verify-vignette.ts
    - prisma/migrations/20260811070000_add_vignette_check/migration.sql
    - tests/unit/vignette.test.ts
    - tests/unit/vignette-cooldown.test.ts
    - tests/integration/vignette-checks.test.ts
    - tests/e2e/vignette.spec.ts
  modified:
    - prisma/schema.prisma
    - app/cars/actions.ts
    - app/cars/page.tsx
    - playwright.config.ts
    - tests/integration/setup.ts
    - tests/e2e/accessibility.spec.ts
    - package.json
    - .env.example

key-decisions:
  - "The body is the signal, never the HTTP status — every response is 200"
  - "'none' and 'unavailable' never collapse; UNAVAILABLE rows are stored"
  - "The cooldown IS the rate limit, derived from checkedAt"
  - "VIGNETTE_DRIVER defaults to live, unlike STORAGE_DRIVER's safe default"

patterns-established:
  - "Verify an external client against the real service, and correct the fixtures from it"
  - "Gate an action's button server-side, and enforce the same rule in the action anyway"

duration: 55min
started: 2026-08-11T06:40:00Z
completed: 2026-08-11T07:35:00Z
description: "A car's Bulgarian vignette status is visible and refreshable on /cars, and an unreachable service never reads as an expired vignette"
type: Summary
about: "gaspense"
---

# Phase 5 Plan 01: The Vignette Check

**Each car's Bulgarian vignette status sits on `/cars`, one tap from being refreshed, cached in a
check log, and limited by a cooldown derived from the data itself. The client was run against the
real service — which corrected a fixture I had invented.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~55 min |
| Started | 2026-08-11T06:40:00Z |
| Completed | 2026-08-11T07:35:00Z |
| Tasks | 3 of 3 completed |
| Files created | 9 |
| Files modified | 8 |
| Tests added | 46 (20 unit, 12 integration, 14 e2e) |
| Dependencies added | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Status visible and refreshable | **Pass** | Not-checked, active with expiry, none, and unavailable all render; one tap refreshes |
| AC-2: The body is the signal | **Pass** | `ok:false` with an embedded 500 parses as `none`; non-JSON, a throw, a scalar body and an unrecognised shape all parse as `unavailable` |
| AC-3: The cooldown refuses a repeat | **Pass** | Six hours, boundary-inclusive, future-dated rows treated as "wait". The button is not offered inside the window **and** the action refuses anyway |
| AC-4: Cannot touch another user's car | **Pass** | A forged `carId` through the real form writes nothing; the victim's car still reads "not checked yet" from their own session. **All four scope filters mutation-proven** |
| AC-5: The suites never call the real service | **Pass** | `VIGNETTE_DRIVER=stub` forced in `tests/integration/setup.ts` and in `playwright.config.ts` — workers *and* the server under test |
| AC-6: Verified against the real service | **Pass** | Both paths run live. **The active-path response corrected a fixture** — see Deviations |
| AC-7: Nothing already green went red | **Pass** | Five gates exit 0, zero warnings. 285 unit, 176 integration, 166 e2e. `/cars` audited for the first time. **Confirmed in CI on run 31507634624 — green, 166 passed, no flaky annotation** |

## Verification Results

Exit codes read directly, never through a pipe:

| Command | Exit | Result |
|---------|------|--------|
| `npm run check` | 0 | zero warnings |
| `npm run build` | 0 | |
| `npm test` | 0 | **285** (was 265) |
| `npm run test:integration` | 0 | **176** (was 164) |
| `npm run test:e2e` | 0 | **166** (was 152) |

**627 tests total, up from 581.**

### Mutation testing — a second clean sweep

| Mutation | Result |
|----------|--------|
| `recordVignetteCheck` loses its ownership **pre-check** | **Red** (2 tests) |
| `getCarVignetteStatuses` loses its relation filter | **Red** (3 tests) |
| `getLastVignetteAttempt` loses its relation filter | **Red** (1 test) |
| `ownedCar` loses `deletedAt: null` | **Red** (2 tests) |

Every filter load-bearing, two plans running. The question has now been asked six times across the
project and produced six different answers — which is exactly why it keeps being asked.

### Real-service verification

`npm run verify:vignette` against `check.bgtoll.bg`:

- a plate with no vignette → `none`
- a plate with an active one → `active`, with `validUntil` parsed

## Accomplishments

- **Phase 5 delivers user-visible value with no personal data involved at all.** The vignette half
  needed no ЕГН, no encryption, and no new trust boundary.
- **An outage can never read as an expired vignette.** Enforced in the client, preserved by the data
  model, proven in e2e, and confirmed by eye.
- **The rate limit needed no new machinery** — a stored timestamp, which a serverless process cannot
  fail to share and a cold start cannot forget.
- **`/cars` is audited** — one of the five routes 04-02 named as unaudited. Three remain.
- **05-02 inherits both hard parts**: body-first parsing and a proven test seam.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Parse the body, never the HTTP status | Every response is HTTP 200; "no vignette" carries an embedded `status.code: 500` | Reading the status would call a normal answer an outage |
| `none` and `unavailable` never collapse | Reporting "no vignette" during an outage tells someone their vignette expired when it did not | Separate result kinds, separate rows, separate UI copy |
| `UNAVAILABLE` rows are stored | Otherwise a failure is indistinguishable from "never checked" | Two "latests": the last *result* and the last *attempt* |
| `VignetteCheck` is a log, not columns on `Car` | The `OdometerReading` shape. The latest row is the current state, and it answers "when did we last look" | History free; no five denormalised columns |
| The cooldown IS the rate limit | No counter table, no in-memory map separate invocations cannot share, survives a cold start, and it is per car | Six hours, pinned by a test |
| The button is hidden server-side, and the action enforces anyway | Hiding is UX; a form post can be replayed | Both, not either |
| `VIGNETTE_DRIVER` defaults to `live` | A stub default would show *fabricated* vignette dates that a user would trust — worse than an error. Unlike `STORAGE_DRIVER`, whose safe value is the default | The suites must opt in to the stub, in two places |
| Use `statusBoolean`, never the `status` string | That string is Bulgarian display text (`"Активна"`) and will be reworded without notice | |
| The country stays hardcoded `BG` | `Car` has no country column and there is no plate regex, both by standing decision. A foreign plate reports "no active **Bulgarian** vignette" — literally true | Labelled that way in the UI |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 3 | One invented fixture corrected from reality; one design improvement forced by a type error; one stale doc |
| Scope additions | 0 | |
| Deferred | 1 | Logged below |

### Auto-fixed Issues

**1. [test-validity] An invented fixture, corrected from the live service**

- **Found during:** Task 3's AC-6 verification
- **Issue:** the "exempt vignette" unit fixture gave a plausible `vignetteNumber` and a plausible
  `validityDateFrom`. The real service returns **`vignetteNumber: null`** and a **sentinel
  `validFrom` of `1980-01-01T02:00:00`** for an exempt vehicle
- **Fix:** the fixture now matches the observed response, with a comment recording that it was
  corrected and why
- **Why it matters:** the client handled both correctly, so nothing was broken — but the test was
  asserting against fiction, which is exactly the state 04-04's Supabase adapter was in when its
  stub-based tests passed while it mishandled every missing object

**2. [design] `<form action>` cannot return a value — which produced a better answer**

- **Found during:** Task 2, on the type check
- **Issue:** `checkVignetteAction` returned a result object so the page could report a cooldown
  refusal. A `<form action>` must return `void`, and honouring that would have meant a client
  component and `useActionState` for a message
- **Fix:** the cooldown is computed server-side and **the button is not rendered at all** inside the
  window, replaced by "Can check again in about N min". No client component, no message to display,
  and nothing to refuse. **The action still enforces the cooldown**, because hiding a button does not
  stop a form post being replayed
- **Verification:** the e2e test asserts the button disappears and the wait text appears

**3. [documentation] The accessibility spec's own header contradicted its contents**

- **Found during:** Task 3, immediately after adding `/cars`
- **Issue:** the file header still read "Four pages" and listed `/cars` among the *unaudited* routes
- **Fix:** header corrected to six audited pages and three remaining, with a note that every plan
  adding a page should shorten the list. A doc that misstates its own coverage is worse than none

### Deferred Items

- **Check cadence.** Manual only, unchanged: automatic or scheduled checking needs a scheduler this
  project does not have, and the deferred issue predates this plan.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| A throwaway screenshot script showed the unavailable car as "not checked yet" | **My script, not the app.** It navigated immediately after clicking, aborting the in-flight submit. Waiting for each action to land showed all four states correct. Worth recording because the instinct on seeing it was to suspect the feature |
| The integration helper passed a date string where Prisma wanted a `Date`, through a create-then-update tangle | Rewritten to set `checkedAt` directly on create |

## Next Phase Readiness

**Ready:**

- 05-02 inherits the pattern it most needs: a body-first client for a service that answers 200 for
  everything, and a driver seam the suites force to a stub
- The cooldown approach transfers directly, and matters more there — МВР is *confirmed* throttled
- `/cars` is audited, so a fines surface added to the same page is already covered

**Concerns:**

- **The endpoint is unofficial and undocumented.** It can change without notice, and only
  `npm run verify:vignette` would reveal it. Nothing in CI touches the real service, deliberately
- **A malformed plate is indistinguishable from a plate with no vignette** — the service returns the
  same body. Someone mistyping a plate will be told they have no vignette
- **A foreign-plated car reports "no active Bulgarian vignette"**, which is true but could read as a
  bug to someone who does not notice the word "Bulgarian"
- **Three routes remain unaudited** for accessibility: `/cars/new`, `/categories`, and the report and
  odometer pages
- **05-02 carries the three unknowns discovery could not close**: the currency of a fine amount, the
  МВР throttle threshold and whether it is per-IP, and whether МВР is reachable from Vercel at all

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 05-bulgarian-integrations, Plan: 01*
*Completed: 2026-08-11*
