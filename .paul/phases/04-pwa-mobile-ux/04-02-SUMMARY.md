---
phase: 04-pwa-mobile-ux
plan: 02
subsystem: ui
tags: [accessibility, axe-core, wcag, expenses, forms, keyboard, playwright, pwa-shortcuts]

requires:
  - phase: 02-foundations
    provides: ExpenseForm, createExpenseAction, and createExpense's ownership verification
  - phase: 03-reporting
    provides: The dashboard whose car cards this plan turned into actions
  - phase: 04-pwa-mobile-ux
    provides: The manifest (04-01) that now advertises the quick-add shortcuts
provides:
  - One-tap expense entry from the dashboard, down from three taps
  - A car-agnostic /expenses/new that resolves the car itself
  - The project's first accessibility gate, with its blind spots measured
  - Installed-app shortcuts pointing at the car-agnostic route
affects: [04-03 attachments, 07 maintenance reminders, any future page needing an a11y gate]

tech-stack:
  added: ["@axe-core/playwright (devDependency)"]
  patterns:
    - "Accessibility gated on serious/critical; advisories recorded, not gated"
    - "A three-case tagged union instead of a nullable id for resolution results"
    - "Audit preconditions must not depend on the thing being audited"

key-files:
  created:
    - lib/quick-add.ts
    - app/expenses/new/page.tsx
    - tests/unit/quick-add.test.ts
    - tests/unit/expense-form.test.tsx
    - tests/integration/quick-add.test.ts
    - tests/e2e/quick-add.spec.ts
    - tests/e2e/accessibility.spec.ts
  modified:
    - app/page.tsx
    - app/cars/[id]/expenses/expense-form.tsx
    - app/manifest.ts
    - tests/e2e/home.spec.ts
    - package.json
    - CLAUDE.md
    - AGENTS.md
    - docs/ARCHITECTURE.md

key-decisions:
  - "The car-agnostic route accepts no carId parameter at all"
  - "The default car is the most recently added, reusing listActiveCars' existing ordering"
  - "axe gates on serious/critical only; moderate and minor are printed and recorded"
  - "Manifest shortcuts added so the car-agnostic route has a consumer"

patterns-established:
  - "An audit's preconditions must not depend on the association it audits"
  - "Prove a new gate can fail before trusting a clean result from it"
  - "Assert tab order as a subsequence — real controls have internal stops"

duration: 85min
started: 2026-08-10T15:35:00Z
completed: 2026-08-10T17:45:00Z
description: "Logging a fill-up costs one tap instead of three, and the project has an accessibility gate whose blind spots are measured rather than assumed"
type: Summary
about: "gaspense"
---

# Phase 4 Plan 02: Quick Add and the First Accessibility Audit

**Adding a fuel expense went from three taps to one, a car-agnostic `/expenses/new` gives the
installed app a shortcut target, and the project has its first accessibility gate — proven capable
of failing, with two blind spots measured rather than assumed.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~85 min working time (~2h elapsed, including review pauses) |
| Started | 2026-08-10T15:35:00Z |
| Completed | 2026-08-10T17:45:00Z |
| Tasks | 3 of 3 completed |
| Files created | 7 |
| Files modified | 8 |
| Tests added | 46 (12 unit, 6 integration, 28 e2e) |
| Dependencies added | 1 devDependency (`@axe-core/playwright`) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: One tap from the dashboard | **Pass** | A single click reaches `/cars/[id]/expenses/new?type=fuel` with the fuel fields already visible. Was three taps |
| AC-2: The car-agnostic route resolves the car | **Pass** | No picker with one car; a select defaulting to the newest with several; redirect to `/cars/new` with none. All three proven in e2e and again at the data layer |
| AC-3: Cannot write to someone else's car | **Pass** | `createExpense` returns null and the victim's list is unchanged on re-read. **Mutation-checked**: swapping in the attacker's own car turns it red |
| AC-4: Zero serious/critical a11y violations | **Pass** | 4 pages × 2 viewports, **zero serious, zero critical, zero advisories**. Gate proven able to fail via a real contrast regression |
| AC-5: Usable by keyboard alone | **Pass** | Amount focused on arrival; Tab reaches Amount → Category → Date → Notes → Litres → Full tank → submit, in order; Enter submits |
| AC-6: Nothing already green went red | **Pass** | All five gates exit 0. 218 unit, 142 integration, 130 e2e. CI confirmation pending push |

## Verification Results

Exit codes read directly, never through a pipe:

| Command | Exit | Result |
|---------|------|--------|
| `npm run check` | 0 | docs, Prettier, ESLint, markdownlint |
| `npm run build` | 0 | `/expenses/new` registered |
| `npm test` | 0 | **218** (was 206) |
| `npm run test:integration` | 0 | **142** (was 136) |
| `npm run test:e2e` | 0 | **130** (was 102) |

**490 tests total, up from 444.**

### Mutation and control testing

| Check | Expected | Actual |
|-------|----------|--------|
| Isolation test with the attacker's own `carId` | red | Red — "expected {…} to be null" |
| Remove the amount label's `htmlFor` (**planned control**) | audit red | **Green.** See Deviations — the control was wrong, not the audit |
| Introduce a real contrast regression | audit red | Red — `[serious] color-contrast`, with rule id and selector |
| Nest the card actions inside the report link | audit red | **Green** — the HTML parser silently unnests `<a>`, so `nested-interactive` never fires |

## Accomplishments

- **The phase goal's second half is met and measured.** Three taps to one, asserted as a single
  click in e2e rather than claimed in prose.
- **The project has an accessibility gate for the first time**, after being carried as a concern
  since Phase 2 — and, more valuable than the clean result, **two documented limits on what it
  catches**. A gate believed to cover more than it does is worse than no gate.
- **The car-agnostic route has a consumer.** Manifest `shortcuts` mean long-pressing the installed
  icon offers "Add fuel" straight to the form.
- **`ExpenseForm` serves both entry points from one component**, with the car select safe because
  ownership was already verified in the same query that writes — re-proven at the new call site.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `/expenses/new` accepts no `carId` parameter | Per-car adds have their own route; a stale or foreign id would force a choice between 404, silent fallback and error, all worse than not offering it | The route cannot be deep-linked to a specific car — deliberate |
| The default car is the most recently **added** | `listActiveCars` already orders `createdAt: "desc"`, so it costs no query. "Most recently used" needs a new scoped query shape, which by standing rule needs its own isolation *and* mutation test — to buy a preselected `<option>` | Deferred, logged |
| Three-case tagged union, not a nullable id | An earlier shape returned `{ defaultCarId: "" }`, and an empty string is exactly what a caller passes into a query believing it is an id | `no-cars` cannot be mistaken for a car |
| axe gates on serious/critical only | A gate that fails the build on an advisory gets switched off within a month, and then nothing is gated | Advisories printed on passing runs; count recorded here (zero) |
| Four pages audited, five named as not | An audit whose scope is implied by its filename overstates itself | The gap is visible in CLAUDE.md and AGENTS.md |
| The report link gained an `aria-label` | Its accessible name was the whole card — "DEMO-0001 Demo car €4,552.70 · 7.0 L/100km" — which never said where it goes | Also disambiguates `home.spec.ts`'s locator |
| Manifest `shortcuts` added | The route existed with nothing pointing at it | Scope addition; see Deviations |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 3 | All defects in this plan's own tests |
| Scope additions | 1 | Manifest shortcuts — completes the route's stated purpose |
| Deferred | 3 | Logged below |

**Total impact:** No scope creep. The planned accessibility control turned out to be invalid and was
replaced with two that work — the most important outcome of the plan.

### Auto-fixed Issues

**1. [test-validity] The planned positive control for the audit did not work**

- **Found during:** Task 2, running the control the plan specified
- **Issue:** removing the amount label's `htmlFor` produced **no** axe violation. The input carries
  `placeholder="45.20"`, and a placeholder satisfies the accessible-name computation, so axe's
  WCAG-tagged rules pass it. The plan assumed a control that could not fire
- **Fix:** replaced with a real contrast regression, which reports `[serious] color-contrast` and
  turns the test red. Additionally checked nested `<a>` and found the HTML parser silently unnests
  it, so `nested-interactive` cannot fire either. Both limits documented in `CLAUDE.md`,
  `AGENTS.md`, and the spec header; the label association is covered instead by the Tab-order e2e
  test and `tests/unit/expense-form.test.tsx`
- **Why it matters:** the audit reports zero violations. Without a working control, "zero" and
  "the gate cannot fire" are indistinguishable

**2. [test-design] The audit's precondition depended on the thing it audits**

- **Found during:** Task 2, the first control run
- **Issue:** each audit test waited on `getByLabel("Amount (€)")`. With the label association
  broken, the test failed on that wait and **axe never ran** — failing for the wrong reason, which
  looks like a working control and is not
- **Fix:** preconditions now wait on `#amount`. An audit must still reach axe on a page whose labels
  are broken; that is the case it exists for

**3. [test-correctness] Two e2e assertions were wrong about the real browser**

- **Found during:** Task 3, first run
- **Issue (a):** the odometer assertion matched two elements — the reading appears both as the
  latest-reading headline and in the list. Strict-mode violation, not a missing value
- **Issue (b):** the keyboard test pressed Tab once per field. Chromium's `<input type="date">` has
  internal day/month/year tab stops, so one Tab moves *within* the control and the test failed on
  correct browser behaviour
- **Fix:** the odometer assertion is scoped to the list; the keyboard test collects the focus
  sequence over 20 Tabs, collapses consecutive duplicates, and asserts the expected order as a
  subsequence — which is what "visual order" actually means

### Scope Additions

**Manifest `shortcuts` (`app/manifest.ts`, not in `files_modified`).** The screenshots made it plain
that **nothing in the app links to `/expenses/new`** — with cars on screen the per-card actions are
strictly better. The plan justified the route as "what a home-screen shortcut can point at", so
wiring that shortcut completes the stated intent rather than widening it. Ten lines and one
assertion. Without it the route had no consumer.

### Deferred Items

- **"Most recently used" as the default car.** Needs a new scoped query shape and, by standing rule,
  its own isolation and mutation tests. Currently the most recently *added*.
- **Five routes remain unaudited:** `/cars`, `/cars/new`, the edit pages, `/categories`, and the
  report and odometer pages. Named in `CLAUDE.md` and `AGENTS.md`.
- **No persistent navigation.** Every page still hand-rolls its own back link. Decided out of this
  plan at planning time; the audit surfaced no reason to revisit it urgently.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Adding card actions broke `home.spec.ts`'s `getByRole("link").first()` — predicted at planning time | Gave the report link an explicit `aria-label`; the test now names it. Better for screen readers too |
| A `/DEMO-0001/` regex would have matched the action links as well, since their labels name the plate | Named the report link exactly rather than matching on the plate |

## Next Phase Readiness

**Ready:**

- 04-03 inherits a working accessibility gate — new pages can be added to
  `tests/e2e/accessibility.spec.ts` in one line each, which matters for a photo-upload UI
- The expense form now has a proven pattern for an optional extra field group, which is the shape
  attachment upload will need
- `lib/quick-add.ts` is pure and DB-free, joining `aggregation`, `consumption` and `chart`

**Concerns:**

- **The audit's clean result is narrow.** Four of nine routes, WCAG-tagged rules only, and two
  measured blind spots. It is a real gate, not a WCAG AA certification, and the success metric in
  `PROJECT.md` should keep saying so
- **`autoFocus` is on the quick-add path only.** It is a deliberate exception to a rule most
  accessibility guidance states flatly; justified for a single-purpose form opened to type one
  number, and it would be wrong to spread it
- **Nothing links to `/expenses/new` from within the app** — by design, reached via the installed
  app's shortcuts. If the shortcuts are ever removed the route becomes orphaned
- **Still no real home-screen install** performed, carried from 04-01 — and the shortcuts added here
  are another thing that only a real install can confirm

**Blockers:** None. 04-03 needs the Supabase project the user has taken on.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 04-pwa-mobile-ux, Plan: 02*
*Completed: 2026-08-10*
