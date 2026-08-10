# CLAUDE.md

Operating instructions for Claude Code working in this repository. Read this before making changes.

For the human-facing project brief see [README.md](README.md). For the design reference (data model, API surface) see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What This Is

Gaspense is a mobile-first PWA for tracking personal vehicle expenses — fuel, maintenance, taxes, body work, fines, and vignette validity — with real cost reporting (monthly/yearly, by category, cost-per-km) and Google Drive export.

**Core value:** track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.

It is a personal project shared with trusted friends and family, each with their own account. It is not for sale and not a multi-tenant SaaS.

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

## Commands

Run `npm install` once, then these all work:

| Purpose                  | Command                  |
| ------------------------ | ------------------------ |
| **All gates (this one)** | **`npm run check`**      |
| Dev server               | `npm run dev`            |
| Production build         | `npm run build`          |
| Serve production build   | `npm start`              |
| Unit + integration tests | `npm test`               |
| End-to-end tests         | `npm run test:e2e`       |
| Lint code                | `npm run lint`           |
| Lint markdown            | `npm run lint:md`        |
| Format                   | `npm run format`         |
| Check formatting         | `npm run format:check`   |
| Seed system categories   | `npm run db:seed`        |
| Seed demo data (dev)     | `npm run db:seed:demo`   |
| Create the test database | `npm run db:test:setup`  |
| Regenerate the PWA icons | `npm run icons:generate` |

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

The app is an installable PWA. Four files, and one rule that matters more than the rest.

| File                                  | What it is                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `app/manifest.ts`                     | The manifest, served at `/manifest.webmanifest`. Typed, so `next build` catches a malformed one |
| `public/icon.svg`                     | The one hand-authored icon source — glyph only, no background                                   |
| `public/sw.js`                        | The service worker                                                                              |
| `public/offline.html`                 | The static navigation fallback                                                                  |
| `app/service-worker-registration.tsx` | Registers the worker, renders `null`                                                            |

**The caching rule is a security boundary, not a performance setting.** Every page sits behind a
session and renders one user's rows, so a cached navigation response would outlive the session that
authorised it — the app would keep serving a signed-in dashboard after sign-out, from a store the
server can neither reach nor clear. So the worker caches an **allowlist of static assets and nothing
else**: never HTML, never `/api`, never a non-GET, never an opaque cross-origin response.
Navigations are network-only, falling back to `/offline.html` and never to a previous page.

`tests/e2e/pwa.spec.ts` proves it two ways — Cache Storage contains no HTML entry, and an offline
navigation returns a page with the user's data **absent**. Both were confirmed to fail when
navigations are routed through the cache.

- **`CACHE_VERSION` in `public/sw.js` must be bumped when the precache list changes.** `activate`
  deletes every cache not matching it, so bumping is what evicts stale entries. Nothing enforces it.
- **Registration is production-only.** In `next dev` the chunks under `/_next/static` are unhashed,
  so a cache-first worker serves yesterday's chunk and breaks hot reload in a way that looks like a
  compiler bug. e2e runs a production build, so the worker is still fully covered.
- **`npm run icons:generate`** rasterises `public/icon.svg` into the PNGs, using the Chromium
  Playwright already installs — no image library for four files. **The PNGs are committed**: Vercel
  serves `public/` statically and never runs the generator. `tests/unit/icons.test.ts` parses their
  IHDR headers against the sizes the manifest declares, so editing one without regenerating fails
  `npm test` rather than failing silently in a browser.
- Two decisions on the alternatives: not `next-pwa` (unmaintained, pinned to older Next.js), not
  Serwist (maintained, but a build-plugin dependency taken purely for convenience).

## Adding an Expense — Two Entry Points

| Route                               | When                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `/cars/[id]/expenses/new?type=fuel` | The car is already known — the dashboard card actions link here  |
| `/expenses/new?type=fuel`           | Car-agnostic. What a home-screen shortcut or deep link points at |

`/expenses/new` **takes no `carId` parameter, deliberately.** Per-car adds already have their own
route; accepting an id here would mean deciding what to do with a stale or someone else's, and 404,
silent fallback and error are all worse than not offering it. It resolves the car itself via
`resolveQuickAddTarget` in [lib/quick-add.ts](lib/quick-add.ts): no picker with one car, a select
defaulting to the **most recently added** with several, and a redirect to `/cars/new` with none.

- **The default is the newest car, not the most recently used.** `listActiveCars` already orders
  `createdAt: "desc"`, so this costs no query. "Most recently used" would need a new scoped query
  shape — which by the standing rule needs its own isolation _and_ mutation test, to buy a
  pre-selected `<option>`. Deferred, not forgotten.
- **`ExpenseForm` serves both.** Given a `cars` prop it renders a `<select name="carId">` as the
  first field; given none it keeps the hidden input. `carId` is untrusted either way and
  `createExpense` verifies ownership in the database — which is exactly why offering a select is
  safe, proven in `tests/integration/quick-add.test.ts`.

## Accessibility

`tests/e2e/accessibility.spec.ts` runs `@axe-core/playwright` against WCAG 2 A and AA rules on both
the mobile and desktop viewports. It is part of `npm run test:e2e`.

- **The gate is zero `serious` and zero `critical`.** Moderate and minor findings are printed and
  recorded, not gated — a gate that fails the build on an advisory gets switched off within a month,
  and then nothing is gated at all.
- **Four pages are audited:** `/signin`, `/` (populated), `/expenses/new?type=fuel`, and
  `/cars/[id]/expenses/new?type=fuel`. **Five are not yet:** `/cars`, `/cars/new`, the edit pages,
  `/categories`, and the report and odometer pages. Stated so the gap is visible rather than implied
  by a file called "accessibility".
- **⚠️ What axe does not catch here, measured rather than assumed:**
  - A **placeholder satisfies the accessible-name rules**, so removing the amount field's
    `htmlFor` produces _no_ axe violation. `tests/e2e/quick-add.spec.ts`'s Tab-order test and
    `tests/unit/expense-form.test.tsx` are what cover that.
  - **Nested `<a>` is silently repaired by the HTML parser**, so `nested-interactive` never fires
    for a link inside a link. The dashboard card is still structured to avoid it — the markup should
    be right, not merely undetectably wrong.
- The audit's own preconditions wait on `#amount`, never `getByLabel` — a setup step that depends on
  the association being audited cannot report on it, which is how the first positive-control run
  failed for the wrong reason.
- **Chromium's `<input type="date">` has internal day/month/year tab stops**, so one `Tab` moves
  within the control. The keyboard test collects a sequence and asserts order as a subsequence.

## Conventions

- **TypeScript throughout.** No plain-JS source files — **one documented exception**: `public/sw.js`.
  A service worker is fetched by the browser as a static file and is not in the TypeScript build
  graph; the alternatives are adding a compile step or serving the script as a string from a route
  handler, and both are worse. It is an ES **module** worker, which is what lets
  `tests/unit/sw-policy.test.ts` import its predicates and test the real rule rather than a copy.
  Its types live in `types/sw.d.ts`, not in `public/` — everything in `public/` is fetchable.
- **The app ships almost no client JavaScript, and that is deliberate.** Every page is a server
  component; charts are server-rendered SVG. The only client components are Phase 2's forms and
  delete buttons and the service-worker registration, and each earned it. Do not add a client
  boundary casually.
- **Mobile-first.** Design and test the small viewport first; desktop is secondary.
- **Amounts are EUR only.** No multi-currency conversion logic — this is a deliberate decision, not an oversight.
- **Every API route is scoped by the authenticated `userId`.** Users must only ever see their own cars, expenses, and attachments. Never expose a query that can be widened by passing someone else's ID.
- **Validate at every API boundary** with a schema validator (Zod) — especially amounts, dates, and license plate format.
- **Rate-limit the external check routes** (`/api/fines/check`, `/api/vignette/check`). They call external government services and must not be hammered.

## Testing

Every phase ships with **unit + integration + automation (e2e)** tests. This is an explicit project requirement, not a nice-to-have — a phase is not complete without them.

Do not claim a task is done without running its verification and reading the output.

## Git Workflow

- **Direct commits to `main` are authorized** for this project. No PR-per-change requirement, no feature branches needed.
- Commit as `dnmitev <dnmitev@gmail.com>` (set locally in this repo — verify with `git config user.email`).
- Do not commit generated output, dependencies, or local tooling artifacts; `.gitignore` covers them.

## Where Things Live

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
