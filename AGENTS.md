# AGENTS.md

Instructions for AI coding agents working in this repository, following the [agents.md](https://agents.md) convention. Tool-agnostic — applies to Cursor, Aider, Copilot, Claude Code, and others.

Claude Code users: [CLAUDE.md](CLAUDE.md) carries the same guidance. For the human-facing brief see [README.md](README.md); for the design reference see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project Overview

Gaspense is a mobile-first PWA for tracking personal vehicle expenses — fuel, maintenance, taxes, body work, fines, and vignette validity — with real cost reporting (monthly/yearly, by category, cost-per-km) and Google Drive export.

**Core value:** track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.

Personal project shared with trusted friends and family, each with their own account. Not for sale, not multi-tenant SaaS.

## Stack

| Layer        | Choice                                       |
| ------------ | -------------------------------------------- |
| Frontend     | Next.js (React), TypeScript, installable PWA |
| Backend      | Next.js API routes                           |
| Database     | PostgreSQL via Supabase                      |
| File storage | Supabase Storage (car and expense photos)    |
| Auth         | Google OAuth via NextAuth                    |
| Deployment   | Vercel (app) + Supabase (DB + Storage)       |
| CI           | GitHub Actions                               |

## ⚠️ This Repository Is Public

`github.com/dnmitev/gaspense` is a **public** repo. Nothing sensitive is ever committed.

- **Never commit secrets or real credentials.** Google OAuth client secrets, Supabase service keys, and `NEXTAUTH_SECRET` live only in Vercel / Supabase / GitHub Actions environment variables.
- **Only `.env.example` is tracked.** Every other `.env*` file is gitignored.
- **Never commit personal data.** No real license plates, real names, real addresses, or real expense records in seed data, test fixtures, screenshots, or example values. Use obviously-fake placeholders.
- If you are about to write a value that looks like a real key, token, or plate — stop and use a placeholder.

## Setup and Commands

Run `npm install` once, then these all work:

| Purpose                    | Command                   |
| -------------------------- | ------------------------- |
| **All gates (this one)**   | **`npm run check`**       |
| Dev server                 | `npm run dev`             |
| Production build           | `npm run build`           |
| Serve production build     | `npm start`               |
| Unit + integration tests   | `npm test`                |
| End-to-end tests           | `npm run test:e2e`        |
| Lint code                  | `npm run lint`            |
| Lint markdown              | `npm run lint:md`         |
| Format                     | `npm run format`          |
| Check formatting           | `npm run format:check`    |
| Seed system categories     | `npm run db:seed`         |
| Seed demo data (dev)       | `npm run db:seed:demo`    |
| Create the test database   | `npm run db:test:setup`   |
| Regenerate the PWA icons   | `npm run icons:generate`  |
| Verify the vignette client | `npm run verify:vignette` |

`npm run check` is the docs + style gate: it verifies the agent docs exist, then runs
`format:check`, `lint`, and `lint:md`. Run it before committing — the pre-push hook runs it anyway.

### Test database

There are **two databases on the one container**: `gaspense_dev` for development and
`gaspense_test` for the suites. `npm run db:test:setup` creates and migrates the test one and is
idempotent, so it is safe to re-run and safe on a fresh clone.

- **`TEST_DATABASE_URL` selects it**, and the suites overwrite `DATABASE_URL` with that value for
  the duration of a run — so an exported production `DATABASE_URL` is never connected to.
- **Unset, the suites fall back to `DATABASE_URL`.** That is how CI works, because CI already
  points `DATABASE_URL` at a throwaway `gaspense_test`. Locally, leaving it unset makes the
  integration suite **refuse to run** rather than truncate `gaspense_dev` — see the guard below.
- **The integration suite truncates the test database on every run**, and nothing else. e2e shares
  the same database; it creates randomly-named users and deletes them rather than truncating.

**The guard.** `resetDatabase()` refuses to truncate unless **both** hold: the host is local
(`localhost`, `127.0.0.1`, `::1`) **and** the database name ends in `_test`. Both, not either — a
real database can satisfy one by accident. CI's connection string satisfies the rule with no
special casing, and that exact string is pinned in a unit test.

When it refuses, it names the database and the rule that failed. The fix is to set
`TEST_DATABASE_URL` and run `npm run db:test:setup`.

**There is deliberately no override flag.** An `ALLOW_DESTRUCTIVE_TESTS`-style variable gets set
once in `.env` and forgotten, so it stays true when your shell later points somewhere real — it
detaches the permission from the target, which is the one thing a guard must not do.

### Demo data

`npm run db:seed:demo -- --email you@example.com` attaches about twelve months of history —
one car, ~28 fuel fills with odometer readings, ~19 other expenses — to an account that
**already exists**. Sign in with Google once first: the command deliberately never creates the
user, because seeding a `User` row with no linked `Account` makes Google sign-in fail with
`OAuthAccountNotLinked`.

- `--anchor YYYY-MM-DD` pins the end date for reproducible output; it defaults to today so the
  current month always has data.
- `--clear` removes the demo car and everything on it.
- **This data survives a test run.** The suites truncate `gaspense_test`, never `gaspense_dev` —
  see [Test database](#test-database) above. Until Phase 8 that was not true, and running
  `npm run test:integration` wiped the seeded account along with everything else.

The dataset deliberately contains a partial fill, a fill with no odometer reading, and one
reading lower than its predecessor — the awkward cases fuel-consumption reporting has to
survive. Do not "tidy" them away.

## CI and Quality Gates

- **CI runs `npm run check`, `npm run build`, `npm test`, and `npm run test:e2e`** on every push to
  `main` and on every PR to `main`, via `.github/workflows/ci.yml`. It installs with `npm ci` on
  Node 22 and installs Chromium for Playwright.
- **A pre-push hook runs the check gate locally**, so lint/format failures are caught before
  anything reaches GitHub (`.githooks/pre-push`). It activates automatically on `npm install` via
  the `prepare` script — a fresh clone needs no manual `git config`. Note it runs `check` only, not
  the test suites.
- **Deliberate bypass:** `git push --no-verify`. Use it sparingly; CI still catches the problem
  afterwards.
- **There is no branch protection.** Direct pushes to `main` are authorised, which is exactly why
  the local hook exists — CI alone reports _after_ code has already landed.
- **e2e runs against the production build, never `next dev`.** Playwright's `webServer` runs
  `npm run build && npm start`. This is deliberate: `next dev` regenerates the
  `nextjs-agent-rules` block in `AGENTS.md`, which would leave the working tree dirty after every
  test run.
- **`reuseExistingServer` is off**, so a local e2e run needs port 3000 free and will fail loudly if
  it is not. Reuse was removed deliberately: `npm run dev` serves `gaspense_dev` while the e2e
  helpers write to `gaspense_test`, so a reused server would test the wrong database and pass.
- **Unit tests use Vitest with `globals: false`**, so Testing Library's cleanup is wired manually in
  `tests/unit/setup.ts`. Without it each test's DOM leaks into the next and queries start matching
  elements from earlier tests.
- **Secret scanning and push protection are active.** GitHub itself rejects a push containing a
  recognised secret. Treat that as a safety net, not a strategy: never write a real credential to a
  file in the first place.

## PWA

The app is an installable PWA: `app/manifest.ts` (the manifest, typed so `next build` catches a
malformed one), `public/icon.svg` (the one icon source), `public/sw.js` (the service worker),
`public/offline.html` (the static navigation fallback), and
`app/service-worker-registration.tsx` (registers the worker, renders `null`).

**The caching rule is a security boundary, not a performance setting.** Every page sits behind a
session and renders one user's rows, so a cached navigation response would outlive the session that
authorised it — the app would keep serving a signed-in dashboard after sign-out, from a store the
server can neither reach nor clear. The worker caches an **allowlist of static assets and nothing
else**: never HTML, never `/api`, never a non-GET, never an opaque cross-origin response.
Navigations are network-only, falling back to `/offline.html` and never to a previous page.

`tests/e2e/pwa.spec.ts` proves it two ways — Cache Storage holds no HTML entry, and an offline
navigation returns a page with the user's data **absent**. Both were confirmed to fail when
navigations are routed through the cache.

- **`CACHE_VERSION` in `public/sw.js` must be bumped when the precache list changes.** `activate`
  deletes every cache not matching it. Nothing enforces this.
- **Registration is production-only.** `next dev` serves unhashed chunks under `/_next/static`, so a
  cache-first worker breaks hot reload in a way that looks like a compiler bug. e2e runs a
  production build, so the worker is still covered.
- **`npm run icons:generate`** rasterises `public/icon.svg` into the PNGs using the Chromium
  Playwright already installs. **The PNGs are committed** — Vercel serves `public/` statically and
  never runs the generator. `tests/unit/icons.test.ts` parses their IHDR headers against the sizes
  the manifest declares, so editing one without regenerating fails `npm test`.
- Not `next-pwa` (unmaintained, pinned to older Next.js) and not Serwist (maintained, but a
  build-plugin dependency taken purely for convenience).

## Adding an Expense — Two Entry Points

`/cars/[id]/expenses/new?type=fuel` when the car is known (the dashboard card actions link here),
and `/expenses/new?type=fuel` when it is not — the car-agnostic route a home-screen shortcut or deep
link can point at.

`/expenses/new` **takes no `carId` parameter, deliberately**: per-car adds have their own route, and
deciding what to do with a stale or foreign id (404, silent fallback, error) is worse than not
offering the parameter. It resolves the car via `resolveQuickAddTarget` in `lib/quick-add.ts` — no
picker with one car, a select defaulting to the **most recently added** with several, a redirect to
`/cars/new` with none.

- The default is the newest car because `listActiveCars` already orders `createdAt: "desc"`. "Most
  recently used" would need a new scoped query shape, which by the standing rule needs its own
  isolation and mutation test — to buy a pre-selected `<option>`. Deferred.
- `ExpenseForm` serves both entry points: a `cars` prop renders a `<select name="carId">` as the
  first field, otherwise the hidden input stays. `carId` is untrusted either way and `createExpense`
  verifies ownership in the database, which is what makes the select safe.

## Attachments (photos)

A photo attaches to an expense at creation or afterwards. `lib/storage.ts` (the `ObjectStorage`
interface plus a local filesystem adapter), `lib/attachments.ts` (scoped data access — ownership
runs `expense → car → userId`), `app/cars/[id]/expenses/attachment-field.tsx` (client component,
downscales via canvas), and `app/api/attachments/[id]/route.ts` (ownership-checked serving).

- **Attachments belong to a car OR an expense**; the filter in `lib/attachments.ts` is an **OR over
  both paths**, each with `deletedAt: null`. 04-03 scoped only through `expense`, which made a car
  photo return 404 to its own owner. All three parts are mutation-proven load-bearing.
- **`STORAGE_DRIVER`** picks the backend (`local` default, `supabase` opt-in). **A missing Supabase
  variable is a hard failure, never a fall back** — Vercel's filesystem is ephemeral, so a silent
  fall back loses every photo while appearing to work.
- **⚠️ The Supabase bucket must be PRIVATE**, and `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- **No `@supabase/supabase-js`** — three `fetch` calls. ⚠️ Unit-tested against a **stub**, which
  cannot confirm the real API. See 04-04's summary for whether it has been verified for real.
- **`db:seed:demo --clear`** is the only hard delete of a car and deletes objects before the row.
- **⚠️ `.storage/` is gitignored and must NEVER be under `public/`.** Anything there is served
  statically with no session check — every photo world-readable at a guessable path. Override with
  `STORAGE_LOCAL_ROOT`. Supabase Storage replaces the adapter in 04-04.
- Keys are opaque (`randomUUID` + an extension from the _validated_ MIME type, never the client's
  filename) and never leave the server — the route takes the row id.
- **404, never 403**, for someone else's attachment and for no session. A 403 confirms the id
  exists. `/api/*` is outside the service worker's cache allowlist, so photos are never cached.
- Exactly one of `carId`/`expenseId` is enforced by a hand-written CHECK constraint
  (`num_nonnulls(...) = 1`); Prisma cannot express one.
- `deleteExpense` deletes stored objects **before** the row — the cascade would otherwise orphan
  every object, since nothing knows the keys afterwards.

### Three size limits, all load-bearing

| Limit              | Value                           | Where                                      |
| ------------------ | ------------------------------- | ------------------------------------------ |
| Browser downscale  | 1600px longest edge, JPEG ~0.85 | `lib/image.ts`                             |
| Validation         | 2 MB                            | `lib/validation/attachment.ts`             |
| Next server action | 3 MB                            | `next.config.ts` — **the default is 1 MB** |

Found by measurement: a 4000×3000 image downscaled to 1137 KB and the server action was rejected
before running, with no error shown. Re-check `bodySizeLimit` if the downscale target changes.

The browser is never trusted — canvas unavailable means the original uploads and the server refuses
it; the declared MIME is checked against the leading bytes and the declared size against the actual
length. Width/height are a hint for sizing the `<img>` only, and the e2e test polls
`naturalWidth > 0` because `toBeVisible()` passes on a broken image.

**⚠️ No EXIF stripping** — a canvas re-encode drops it as a side effect, not a guarantee, and the
fallback path preserves it. Settle before any deployment carries real photos.

## Bulgarian Vignette Check

Per car on `/cars`, via `check.bgtoll.bg` — **no credentials**, keyed by licence plate.
`lib/vignette.ts` (client + `VIGNETTE_DRIVER`), `lib/vignette-stub.ts` (test double),
`lib/vignette-checks.ts` (scoped access + cooldown), `scripts/verify-vignette.ts`.

- **⚠️ The body is the signal, never the HTTP status.** Every response is 200, including "no
  vignette" — which carries an embedded `status.code: 500`. Use `statusBoolean`, not the Bulgarian
  `status` string.
- **⚠️ `none` and `unavailable` must never collapse.** An outage reported as "no vignette" tells
  someone their vignette expired when it did not. `UNAVAILABLE` rows are stored; the UI reads the
  latest _successful_ check for status and the latest row of any kind for "last tried".
- A malformed plate returns the same body as a plate with no vignette. No plate regex here.
- The country is hardcoded `BG`; a foreign plate reports "no active Bulgarian vignette", which is
  true, and is labelled that way.
- **The cooldown IS the rate limit** — six hours, derived from `checkedAt`. The page hides the
  button; the action enforces it anyway, because a form post can be replayed.
- **⚠️ `VIGNETTE_DRIVER` defaults to `live`**, unlike `STORAGE_DRIVER` — a stub default would show
  fabricated dates in production. **The suites force `stub` in two places.**
- `VignetteCheck` is a log, not columns on `Car`.
- Fixtures are observed, not invented; one was corrected live (an exempt vignette has
  `vignetteNumber: null`). Re-run `npm run verify:vignette` when the client changes.

## Accessibility

`tests/e2e/accessibility.spec.ts` runs `@axe-core/playwright` over WCAG 2 A/AA on both viewports, as
part of `npm run test:e2e`.

- **Gate: zero `serious` and zero `critical`.** Moderate/minor are printed and recorded, not gated —
  a gate that fails on an advisory gets switched off, and then nothing is gated.
- **Audited:** `/signin`, `/`, both add forms, the expense edit page with a photo, `/cars`, and the
  car edit page with a photo. **Not yet audited:** `/cars/new`, `/categories`, the report and
  odometer pages.
- **⚠️ Measured limits of the gate:** a `placeholder` satisfies the accessible-name rules, so a lost
  `htmlFor` on the amount field produces no axe violation (the Tab-order e2e test and
  `tests/unit/expense-form.test.tsx` cover it); and nested `<a>` is silently repaired by the HTML
  parser, so `nested-interactive` never fires for a link inside a link.
- The audit waits on `#amount`, never `getByLabel` — a precondition that depends on the association
  being audited cannot report on it.
- Chromium's `<input type="date">` has internal tab stops, so the keyboard test asserts order as a
  subsequence rather than one `Tab` per field.

## Code Conventions

- **TypeScript throughout.** No plain-JS source files — **one documented exception**: `public/sw.js`.
  A service worker is fetched by the browser as a static file and is not in the TypeScript build
  graph; the alternatives are a compile step or serving the script as a string from a route handler,
  and both are worse. It is an ES **module** worker, which is what lets
  `tests/unit/sw-policy.test.ts` import its predicates and test the real rule rather than a copy.
  Its types live in `types/sw.d.ts`, not `public/` — everything in `public/` is fetchable.
- **The app ships almost no client JavaScript, deliberately.** Every page is a server component;
  charts are server-rendered SVG. The only client components are Phase 2's forms and delete buttons
  and the service-worker registration. Do not add a client boundary casually.
- **Mobile-first.** Design and test the small viewport first; desktop is secondary.
- **Amounts are EUR only.** No multi-currency conversion logic — a deliberate decision, not an oversight.
- **Every API route is scoped by the authenticated `userId`.** Users must only ever see their own cars, expenses, and attachments. Never expose a query that can be widened by passing someone else's ID.
- **Validate at every API boundary** with a schema validator (Zod) — especially amounts, dates, and license plate format.
- **Rate-limit the external check routes** (`/api/fines/check`, `/api/vignette/check`). They call external government services and must not be hammered.

## Testing Requirements

Every phase ships with **unit + integration + automation (e2e)** tests. This is an explicit project requirement — a phase is not complete without them.

Do not claim a task is done without running its verification and reading the output.

## Pull Requests and Commits

- **Direct commits to `main` are authorized** for this project. No PR-per-change requirement, no feature branches needed.
- Commit as `dnmitev <dnmitev@gmail.com>` (set locally in this repo — verify with `git config user.email`).
- Do not commit generated output, dependencies, or local tooling artifacts; `.gitignore` covers them.

## Repository Map

| Path                                                           | Contents                                             |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| [README.md](README.md)                                         | Human-facing project brief                           |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                   | Data model, API surface, phase roadmap               |
| [projects/gaspense/PLANNING.md](projects/gaspense/PLANNING.md) | Full ideation record and rationale                   |
| `.paul/PROJECT.md`                                             | Requirements, constraints, key decisions             |
| `.paul/ROADMAP.md`                                             | Phase structure — **authority on phase status**      |
| `.paul/STATE.md`                                               | Current position, deferred issues, active boundaries |
| `.paul/phases/`                                                | Per-phase plans and summaries                        |

This project is managed with the PAUL framework: work proceeds in `PLAN → APPLY → UNIFY` loops. Check `.paul/STATE.md` for the current position before starting anything.

## Known Unknowns

The Bulgarian traffic police (КАТ/МВР) fines lookup and the vignette validity check have **no confirmed public API**. Phase 5 is gated on a research spike. Do not invent endpoint URLs or request shapes for these services — if you need them and they are not yet documented in `docs/ARCHITECTURE.md`, say so instead of guessing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
