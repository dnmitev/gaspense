---
phase: 04-pwa-mobile-ux
plan: 01
subsystem: infra
tags: [pwa, service-worker, manifest, offline, caching, icons, playwright, vitest]

requires:
  - phase: 03-reporting
    provides: A dashboard at `/` behind a session, and an app that was entirely server components
  - phase: 09-demo-data-seed
    provides: `seedDemoData` — the DEMO-0001 fixture the offline-leak test asserts the absence of
provides:
  - An installable PWA — manifest at /manifest.webmanifest, maskable icons, apple-touch-icon
  - A hand-written ES module service worker with a static-assets-only cache allowlist
  - /offline.html — a static navigation fallback carrying no user data
  - Proof, by going offline, that no authenticated HTML is ever cached
  - `npm run icons:generate` — icon rasterisation with no image dependency
affects: [04-02 quick-add and accessibility, 04-03 attachments, 06 Google Drive export]

tech-stack:
  added: []
  patterns:
    - "Service worker cache as an allowlist, treated as a security boundary"
    - "One plain-JS module worker, imported directly by its own unit test"
    - "Generated binary assets committed, with a tracked generator and a dimension test"

key-files:
  created:
    - app/manifest.ts
    - app/service-worker-registration.tsx
    - public/sw.js
    - public/offline.html
    - public/icon.svg
    - scripts/generate-icons.ts
    - types/sw.d.ts
    - tests/unit/sw-policy.test.ts
    - tests/unit/icons.test.ts
    - tests/e2e/pwa.spec.ts
  modified:
    - app/layout.tsx
    - eslint.config.mjs
    - package.json
    - CLAUDE.md
    - AGENTS.md
    - docs/ARCHITECTURE.md

key-decisions:
  - "Hand-written service worker, not next-pwa and not Serwist — zero dependencies"
  - "The cache is an allowlist of static assets; HTML and /api are never cached, ever"
  - "Registered as an ES module worker so its predicates are importable by a unit test"
  - "Registration is production-only — a cache-first worker breaks next dev's unhashed chunks"
  - "Icons rasterised by Playwright's already-installed Chromium; the PNGs are committed"

patterns-established:
  - "A cache boundary is proven by observing an offline navigation, not by asserting a rule"
  - "Assert the ABSENCE of user data, and make the presence-of-something check non-vacuous"
  - "Mutation-test the guard you just wrote; the obvious test often passes for another reason"

duration: 47min
started: 2026-08-10T13:05:00Z
completed: 2026-08-10T13:52:00Z
description: "Gaspense installs to a phone home screen and survives losing the network, with a service-worker cache that provably never holds a signed-in page"
type: Summary
about: "gaspense"
---

# Phase 4 Plan 01: Installable PWA Summary

**Gaspense is installable and works offline, and the service worker provably never caches an
authenticated page — demonstrated by going offline and asserting the user's data is absent, and
confirmed by three mutations that each turn the relevant test red.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~47 min (plan through verification) |
| Started | 2026-08-10T13:05:00Z |
| Completed | 2026-08-10T13:52:00Z |
| Tasks | 3 of 3 completed |
| Files created | 10 |
| Files modified | 6 |
| Tests added | 33 (19 unit, 14 e2e) |
| Dependencies added | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Manifest served, complete, no session required | **Pass** | `/manifest.webmanifest` 200 to a signed-out request, with name, short_name, start_url, `display: standalone`, both colours, 192 + 512 icons and a maskable variant |
| AC-2: Icons are real rasters at declared sizes | **Pass** | IHDR headers parsed off disk and driven from the manifest itself; each icon also fetched over HTTP with `content-type: image/png` |
| AC-3: Worker registers and takes control | **Pass** | `navigator.serviceWorker.ready` resolves with `active.state === "activated"` and a non-null `controller` |
| AC-4: Authenticated HTML never served from cache | **Pass** | Two independent proofs — Cache Storage holds no `/`, `/cars*` or `/api*` entry, and an offline navigation returns `/offline.html` with `DEMO-0001`, "Total across" and any `€` amount absent |
| AC-5: Static assets served offline from cache | **Pass** | `fetch("/icons/icon-192.png")` returns 200 with the context offline |
| AC-6: Nothing already green went red | **Pass** | All five gates exit 0. 206 unit (+19), 136 integration (unchanged), 102 e2e (+14) across both projects. CI confirmation pending the push |

## Verification Results

Exit codes read directly, never through a pipe:

| Command | Exit | Result |
|---------|------|--------|
| `npm run check` | 0 | docs, Prettier, ESLint (including `public/sw.js`), markdownlint |
| `npm run build` | 0 | `app/manifest.ts` type-checks; `/manifest.webmanifest` prerendered static |
| `npm test` | 0 | 14 files, **206** tests |
| `npm run test:integration` | 0 | 14 files, **136** tests |
| `npm run test:e2e` | 0 | **102** tests, desktop + mobile |

**444 tests total, up from 411.**

### Mutation testing — all three behave

| Mutation | Expected | Actual |
|----------|----------|--------|
| Delete `isNavigation` guard from `shouldCache` | unit test red | **green at first** — see Deviations. Red after the test was fixed |
| Route navigations through `fromCacheFirst` | AC-4 red | Red, both AC-4 tests, naming `"/"` in Cache Storage |
| Declare `1024x1024` over the 512px file | `icons.test.ts` red | Red: "expected 512 to be 1024" |

## Accomplishments

- **The cache boundary is a proven property, not a documented intention.** Two orthogonal tests:
  one reads Cache Storage directly and asserts no HTML key exists, the other goes offline and
  asserts the account's data is absent from what comes back. Either alone would have a blind spot.
- **Installable with zero new dependencies.** No `next-pwa`, no Serwist, no image library. The
  manifest is typed so `next build` catches a malformed one; the icons come from one hand-authored
  SVG rasterised by the Chromium Playwright already installs.
- **The icons cannot silently lie about their size.** `tests/unit/icons.test.ts` parses IHDR headers
  and drives its assertions *from the manifest*, so editing a declared size without regenerating
  fails `npm test` rather than failing invisibly in a browser weeks later.
- **All 88 pre-existing e2e tests still pass with a service worker controlling every page** — the
  risk that mattered most when adding a proxy to an app that never had one.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| The SW cache is an allowlist of static assets; HTML and `/api` are never cached | A worker outlives the page installing it. Every page is behind a session and renders one user's rows, so a cached navigation would survive sign-out from a store the server cannot clear | Any future caching change is a security change. Widening the allowlist needs the AC-4 tests re-run |
| Hand-written worker, not `next-pwa` (unmaintained, pinned to older Next.js) nor Serwist (a build-plugin dependency for convenience) | Consistent with hand-rolled Tailwind and hand-rolled SVG charts; keeps the caching rule readable rather than configured | The rule lives in one 170-line file anyone can audit |
| `public/sw.js` is the project's one plain-JS file, by documented exception | A service worker is fetched as a static file and is not in the TypeScript build graph. Alternatives: a compile step, or a script-in-a-string route handler | Types live in `types/sw.d.ts`, deliberately not in `public/` — everything there is fetchable |
| Registered as an ES **module** worker | It is what makes `export`ed predicates importable by Vitest, so the browser and the test run the same source with no second copy of the rule | Requires Chrome 91+/Safari 15+. Acceptable; the e2e suite proves registration |
| Registration is production-only | `next dev` serves unhashed chunks under `/_next/static`; a cache-first worker would serve a stale chunk and break hot reload in a way that reads as a compiler bug | e2e runs a production build, so coverage is unaffected |
| `theme_color` matches the light-scheme `themeColor` rather than the button ink | The installed app's status bar and the browser's chrome tinting the same page differently reads as a bug | Both are `#ffffff`; dark scheme is `#0a0a0a` |
| Generated PNGs are committed | Vercel serves `public/` statically and never runs the generator | A narrow exception to "do not commit generated output", held honest by the tracked script plus the dimension test |
| No offline writes — no background sync, no queued mutations | Queuing writes needs a conflict story this project does not have | Offline means the shell loads and says so |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 2 | Both essential; one was a real test-quality defect |
| Scope additions | 1 | `types/sw.d.ts`, unavoidable |
| Deferred | 1 | Logged below |

**Total impact:** No scope creep. One auto-fix materially improved the plan's own proof.

### Auto-fixed Issues

**1. [correctness] The icon glyph rendered top-left at 100×100 instead of filling its box**

- **Found during:** Task 1, at the qualify step — by looking at the generated PNG, not by reasoning
- **Issue:** `public/icon.svg` carried `width="100" height="100"`, so it rendered at intrinsic size
  wherever placed and the flex centering had nothing to centre
- **Fix:** removed the width/height attributes (viewBox alone sizes it), added an explicit
  `svg { width:100%; height:100% }` rule to the generator's wrapper, and raised the glyph scales
- **Verification:** regenerated and read both the 512 "any" and the maskable PNG back as images
- **Note:** every automated check passed on the broken icons. Only looking caught it

**2. [test-quality] The "never caches a navigation" unit tests passed for the wrong reason**

- **Found during:** Task 3, by mutation testing — deleting the `isNavigation` guard from
  `shouldCache` left the suite **green**
- **Issue:** the assertions used `/` and `/cars/abc123/expenses`, neither of which is on the
  allowlist, so the allowlist alone refused them. The guard under test was doing nothing
- **Fix:** added a case using `/offline.html` — allowlisted, so only the navigation check can refuse
  it — paired with the same path as a subresource asserting `true`, so the test cannot pass by the
  path simply being unreachable. Comments now say which rule each case actually exercises
- **Verification:** mutation A re-run; the new case is the one that goes red
- **Related:** the AC-4 e2e test had the same shape of weakness — it loaded `/` once, before the
  worker controlled the page, so a worker that cached HTML *and* fell back to `/offline.html` would
  have passed. A second, controlled visit was added before going offline; mutation B now fails on
  the leak assertion rather than on a navigation error

### Deferred Items

- **The `/api` check in `sw.js` is unreachable by construction.** Every allowlist entry is rooted
  elsewhere, so no `/api` path can reach it. Kept as defence-in-depth against a future allowlist
  widening, and documented as unreachable in both the worker and its test rather than presented as
  load-bearing. No action needed; recorded so nobody later mistakes it for a proven guard.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Importing `public/sw.js` from a `.ts` test breaks `next build` — `allowJs: false` under `strict`, and tsconfig includes `tests/**` | Added `types/sw.d.ts` declaring the module structurally. Placed outside `public/`, which is publicly fetchable |
| `npm run lint` fails on `self`, `caches`, `clients` — the worker runs in `ServiceWorkerGlobalScope` | Scoped `languageOptions.globals` override for `public/sw.js` in `eslint.config.mjs` |
| An editing slip left an unbalanced `</div>` in the icon generator's template | Caught on re-read before running; the generator's HTML was rewritten with the style rule in `<head>` |

## Next Phase Readiness

**Ready:**

- The install shell is done: manifest, icons, worker, offline page. 04-02 can spend its whole
  budget on the quick-add flow and the accessibility audit
- `tests/e2e/pwa.spec.ts` gives 04-02 and 04-03 a working pattern for offline and Cache Storage
  assertions
- `npm run icons:generate` means a design change to the icon is one command, not four exports

**Concerns:**

- **The app now ships client JavaScript on every page** — one component that renders `null`. It was
  the whole cost of installability and there is no server-side alternative, but the "almost no
  client JS" property is now "almost" in the app shell too. 04-02 should not treat this as a
  precedent
- **`CACHE_VERSION` is bumped by hand.** Change the precache list without bumping it and stale
  entries survive. Nothing enforces this — the same shape of hazard as Phase 8's "a new destructive
  path needs its own `assertTestDatabase` call"
- **A real home-screen install has not been performed.** Every requirement installability depends on
  is proven, but the device install itself is unverified — the analogue of 02-04's untested Google
  login, which stayed open until 09-01
- **Module service workers need Chrome 91+/Safari 15+.** Fine for this project; worth knowing it is
  a floor that exists
- **Still no accessibility audit.** 04-01 changed no user-facing UI, so this remains 04-02's job

**Blockers:** None. 04-02 depends on nothing here; 04-03 needs the Supabase project the user has
taken on.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 04-pwa-mobile-ux, Plan: 01*
*Completed: 2026-08-10*
