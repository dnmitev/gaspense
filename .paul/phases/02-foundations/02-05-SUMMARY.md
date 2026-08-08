---
phase: 02-foundations
plan: 05
subsystem: ui
tags: [server-actions, zod, crud, soft-delete, playwright, isolation, tailwind]

# Dependency graph
requires:
  - phase: 02-04
    provides: lib/session.ts and the isolation test template this plan extends
provides:
  - Scoped car data layer (lib/cars.ts) with five isolation-tested functions
  - Zod validation with deliberately no plate-format regex
  - Server actions for create / update / soft delete
  - Mobile-first car list, form, and delete UI
  - E2E authentication technique reusable by every later authenticated flow
  - docs/ARCHITECTURE.md corrected — server actions replace the never-built REST surface
affects: [02-06, 03-reporting, 04-pwa]

# Tech tracking
tech-stack:
  added: [zod]
  patterns:
    - "Data-layer functions take userId explicitly and never read the session"
    - "Writes to existing rows use scoped updateMany, never findUnique-then-update"
    - "E2E authenticates by seeding a Session row and setting the authjs cookie"
    - "E2E must be verified with CI=true; reuseExistingServer can mask a different server"

key-files:
  created:
    [lib/validation/car.ts, lib/cars.ts, app/cars/actions.ts, app/cars/page.tsx, app/cars/new/page.tsx, "app/cars/[id]/edit/page.tsx", app/cars/car-form.tsx, app/cars/delete-car-button.tsx, tests/e2e/helpers/auth.ts, tests/e2e/cars.spec.ts, tests/unit/validation-car.test.ts, tests/integration/cars.test.ts]
  modified: [playwright.config.ts, .env.example, docs/ARCHITECTURE.md, package.json]

key-decisions:
  - "No licence-plate format regex — the owner may register a car anywhere"
  - "AUTH_URL required for production builds; narrower than trustHost: true"
  - "Delete copy states the expense history is kept, because the deletion is soft"
  - "Cars live at /cars; app/page.tsx untouched so the existing e2e spec keeps passing"

patterns-established:
  - "Every new scoped helper ships with its own cross-user leakage test"
  - "Verify comment-stripped code, not raw file text, when asserting about source"

# Metrics
duration: 28min
started: 2026-08-07T19:00:24Z
completed: 2026-08-07T19:27:53Z
description: "Car CRUD via server actions over a scoped data layer, with soft delete and an authenticated e2e flow that exposed a production-only auth bug"
type: Summary
about: "gaspense"
---

# Phase 2 Plan 05: Car CRUD Summary

**The first real feature: a signed-in user can list, add, edit, and delete their cars, with soft delete keeping expense history — and the e2e suite that proves it caught a production-only auth failure that local runs had been hiding.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~28 min working time (wall clock spans an idle gap) |
| Tasks | 3 of 3 completed (3 PASS / 0 GAP / 0 DRIFT) |
| Files created | 12 |
| Files modified | 4 |
| Tests | **79 total** — 33 unit, 30 integration, 16 e2e (up from 30) |
| Escalation statuses | DONE ×3 |
| CI | `success` after one genuine failure, diagnosed and fixed |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Validation rejects nonsense without rejecting real cars | **Pass** | Six international plate shapes accepted; blank, over-long, fractional year, out-of-range year, and unknown fuel type all rejected. **No format regex exists in code** — verified against comment-stripped source |
| AC-2: Every car data path scoped, isolation proven per helper | **Pass** | All five functions individually verified scoped (four by `where`, `createCar` by `data`). Cross-user read, update, and soft-delete each proven to fail, asserting the victim's row afterwards |
| AC-3: Server actions create, update, soft-delete | **Pass** | All three actions call `requireUserId()` before any data call — verified by parsing each function body, not by line proximity |
| AC-4: UI works at a phone viewport | **Pass** | Single-column, six labelled fields, zero inputs without a matching `<label>`; the whole e2e suite runs on a Pixel 7 project |
| AC-5: E2E signs in and drives the real flow | **Pass** | 16 tests (8 × 2 viewports). The seeded-session probe runs first by design |
| AC-6: Soft delete hides the car but keeps history | **Pass** | Integration test asserts the expense row survives; e2e asserts the confirmation text promises exactly that |
| AC-7: Documentation matches what was built | **Pass** | REST table marked **superseded**, not erased; four genuinely-HTTP endpoints listed with status; stale "JWT session" claim corrected |

## Verification Results

- `tsc --noEmit`, `npm run build`, `npm run check` all exit 0
- Unit 33 / integration 30 / e2e 16, all green; `npm test` still passes with Docker stopped
- E2E re-verified under `CI=true` (fresh production server): 16 passed, zero `UntrustedHost` errors
- CI green across check, build, unit, migrate, integration, e2e
- `app/page.tsx` unchanged; `tests/e2e/home.spec.ts` still passing
- Working tree clean after a full e2e run; `AGENTS.md` untouched
- No credential-shaped strings; no plausibly-real plate anywhere in source

## Accomplishments

- **A CI failure exposed a bug that local testing structurally could not find.** See below — this is
  the most valuable outcome of the plan.
- **Isolation grew with the surface, as the pattern requires.** Five new helpers, five cross-user
  proofs, each asserting the victim's row rather than a returned count.
- **The e2e auth technique now exists** for 02-06 and every later authenticated flow: seed a
  `Session` row, set the `authjs.session-token` cookie. Database sessions made this possible; JWT
  sessions would have required signing tokens in test code.
- **`docs/ARCHITECTURE.md` stopped describing software that was never written.** Nine REST route
  groups had been documented since ideation; they are now marked superseded with the four real
  endpoints listed.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `lib/validation/car.ts` | Created | Zod schema; no plate regex; runtime-derived year bound; fuel enum sourced from Prisma |
| `lib/cars.ts` | Created | Five scoped functions, `userId` always explicit |
| `app/cars/actions.ts` | Created | Server actions; `requireUserId()` first, Zod parse, serialisable results |
| `app/cars/page.tsx` | Created | Server-component list with a real empty state |
| `app/cars/new/page.tsx`, `app/cars/[id]/edit/page.tsx` | Created | Create/edit pages; edit 404s on another user's id |
| `app/cars/car-form.tsx` | Created | Shared client form, six labelled fields, per-field errors |
| `app/cars/delete-car-button.tsx` | Created | Soft-delete control with honest confirmation copy |
| `tests/e2e/helpers/auth.ts` | Created | Seeds user + session, applies the cookie, cleans up |
| `tests/e2e/cars.spec.ts` | Created | 8 specs; auth probe deliberately first |
| `tests/unit/validation-car.test.ts` | Created | 20 validation cases |
| `tests/integration/cars.test.ts` | Created | 12 cases, isolation per helper |
| `playwright.config.ts` | Modified | `webServer.env` with `DATABASE_URL`, `AUTH_SECRET`, and the `AUTH_URL` fix |
| `.env.example`, `docs/ARCHITECTURE.md` | Modified | `AUTH_URL` guidance; API surface corrected |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| No plate-format regex | The owner may register a car in any country; a guessed pattern rejects valid input | Six format shapes asserted to pass |
| Plates uppercased on input | Prevents `xx0000xx` and `XX0000XX` becoming two cars | Applied in the schema, so every path benefits |
| Year bound computed at runtime | A hardcoded year silently starts rejecting new models | `currentYear + 1` |
| Scoped `updateMany` over find-then-update | Puts `userId` in the same WHERE clause as the id | A mismatched owner affects zero rows in one statement |
| `AUTH_URL` rather than `trustHost: true` | Loosening host trust globally to satisfy a test-only need is disproportionate | Set in `webServer.env`; documented for production |
| Honest delete copy | Deletion is soft; claiming permanence would be false | e2e asserts the dialog says the history is kept |
| Cars at `/cars`, root untouched | The existing e2e spec asserts the root's copy; Phase 3 owns the dashboard | No churn, no broken test |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Genuine bug found by CI | 1 | Fixed; a real production-only defect |
| Data-hygiene fix | 1 | Test fixtures desensitised |
| Self-corrected verification errors | 4 | All mine; the code was correct each time |
| Deferred | 0 | — |

### The CI Failure Worth Recording

**All 12 car e2e tests failed in CI while the 4 home tests passed.** My local run had reported *16
passed*, and that result was worthless: `reuseExistingServer: true` had reused a **stale
`next dev` server** left on port 3000 from earlier work, so the suite never touched the production
build the config specifies.

Root cause, from the CI log:

```text
[auth][error] UntrustedHost: Host must be trusted. URL was: http://localhost:3000/api/auth/session
```

Auth.js v5 refuses to infer the host when serving a **production** build. Development mode trusts
localhost automatically, so this class of failure is invisible against `next dev` — which is exactly
the server my local run had reused.

Reproduced deliberately with `CI=true` (forcing a fresh production server), fixed by setting
`AUTH_URL` in `webServer.env`, and re-verified the same way: 16 passed, zero `UntrustedHost`
errors. **"Verify e2e with `CI=true`" is now a recorded standing constraint** — a plain local pass
proves nothing about CI.

Putting the seeded-session probe first paid for itself: all 12 failures pointed at *session
acceptance* rather than car logic, so no time was lost debugging forms.

### Data-Hygiene Fix

**Test plate fixtures were too realistic.** They used sequential digits inside valid registration
formats (`CB 1234 AB`, `CB1234AB`) — plausibly someone's actual plate, in a public repo whose
explicit constraint forbids real plates. Replaced with `XX 0000 XX`-style values that preserve each
format's *shape*, which is what the tests actually assert. The explanatory comment was tightened
afterwards, since it still read as though the values themselves were real registrations.

### Self-Corrected Verification Errors

Four of my own checks produced false results. The code was correct every time.

1. **`requireUserId` in the data layer** — matched the doc comment explaining where callers get it.
2. **"regex" in validation** — matched the comment explaining why there *isn't* one.
3. **"permanently" in delete copy** — matched the comment explaining why the copy avoids that word.
4. **`where`-clause count expected 5, found 4** — my expectation was simply wrong; `createCar` has
   no `where` clause because creates set `userId` in `data`.

The first three are the same failure mode as 02-03's. **Assertions about source must run against
comment-stripped code**, and counting occurrences is weaker than checking each function
individually — both now habit.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `npm run check` failed after Task 2 | Prettier formatting on four new files. Real, not a false positive; fixed with `npm run format`. |
| First `CI=true` reproduction aborted | A stale server still held port 3000 and my `pkill -f "next start"` pattern missed it. Killed by PID via `lsof`, then reproduced cleanly. |
| Playwright's `--list` output did not match my grep | Non-issue — the actual run enumerated the specs, which is stronger evidence than parsing `--list`. |

## Next Phase Readiness

**Ready:**
- The full vertical-slice pattern is established and copyable for 02-06: validation → scoped data
  layer → server actions → server-component UI → isolation tests → authenticated e2e
- `tests/e2e/helpers/auth.ts` removes the auth barrier for every later e2e flow
- `lib/cars.ts` is the shape 02-06's expense and odometer helpers should follow

**Concerns:**
- **02-06 is the first money-facing UI.** `amountCents` must be divided by 100 to display and
  multiplied on input. Nothing in the codebase does this yet, so there is no established helper to
  copy — consider adding a formatting utility with its own unit tests rather than inlining the
  arithmetic at each call site.
- **The e2e suite still asserts placeholder copy on `/`.** Phase 3 turns the root into the dashboard
  and will need `tests/e2e/home.spec.ts` updated. Expected, not a regression.
- **No accessibility audit has been run.** Fields are labelled and the WCAG AA goal is stated, but
  nothing verifies contrast, focus order, or keyboard traps. Worth a dedicated pass once the UI
  surface stops growing.
- **`window.confirm` for deletion** is functional and testable but crude; Phase 4's UX pass may want
  a real dialog, which is the point at which a component library earns its place.
- **CI now runs two builds plus a database.** Runtime is climbing; worth watching.

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 02-foundations, Plan: 05*
*Completed: 2026-08-07*
