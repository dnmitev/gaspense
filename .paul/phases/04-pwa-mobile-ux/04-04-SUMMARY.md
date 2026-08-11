---
phase: 04-pwa-mobile-ux
plan: 04
subsystem: infra
tags: [attachments, supabase, storage, isolation, car-photos, test-safety]

requires:
  - phase: 04-pwa-mobile-ux
    provides: The Attachment entity, ObjectStorage interface and upload path from 04-03
provides:
  - Car photos, on the same ownership terms as expense photos
  - An ownership filter covering both owners, mutation-proven on every branch
  - lib/storage-supabase.ts — a fetch-based Supabase Storage adapter, no SDK
  - STORAGE_DRIVER, with a hard failure instead of a silent fall back
  - Test-suite storage safety — the suites can never write to a real bucket
affects: [any future deployment, 06 Google Drive export]

tech-stack:
  added: []
  patterns:
    - "A driver seam with a hard failure on misconfiguration, never a fall back"
    - "Force the safe backend in test setup, overwriting rather than defaulting"

key-files:
  created:
    - lib/storage-supabase.ts
    - lib/attach-posted-photo.ts
    - tests/unit/storage-supabase.test.ts
    - tests/integration/car-attachments.test.ts
  modified:
    - lib/attachments.ts
    - lib/storage.ts
    - lib/seed-demo.ts
    - app/cars/actions.ts
    - app/cars/car-form.tsx
    - app/cars/[id]/edit/page.tsx
    - app/cars/[id]/expenses/actions.ts
    - playwright.config.ts
    - tests/integration/setup.ts
    - tests/e2e/attachments.spec.ts
    - tests/e2e/accessibility.spec.ts

key-decisions:
  - "Ownership is an OR over both paths; all three branches proven load-bearing"
  - "No @supabase/supabase-js — three fetch calls against the REST surface"
  - "A missing Supabase variable is a hard failure, never a fall back to local"
  - "The suites force STORAGE_DRIVER=local, overwritten not defaulted"

patterns-established:
  - "A stub answers what it is told; verify an adapter against the real service"
  - "Adding a driver seam adds a way for tests to reach production — close it in the same plan"

duration: 70min
started: 2026-08-10T19:55:00Z
completed: 2026-08-10T21:05:00Z
description: "Car photos work on the same ownership terms as expense photos, and a verified Supabase adapter means attachments can survive a deploy"
type: Summary
about: "gaspense"
---

# Phase 4 Plan 04: Car Photos and the Supabase Adapter

**A car carries photos on exactly the same ownership terms as an expense, and the Supabase Storage
adapter has been run against a real project — where it turned out to be wrong in a way that would
have crashed the serving route.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~70 min |
| Started | 2026-08-10T19:55:00Z |
| Completed | 2026-08-10T21:05:00Z |
| Tasks | 3 auto + 1 checkpoint, all complete |
| Files created | 4 |
| Files modified | 11 |
| Tests added | 35 (16 unit, 11 integration, 8 e2e) |
| Dependencies added | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: A car photo is reachable by its owner | **Pass** | And 404 to another user and to no session. Before this plan the owner's own car photo returned 404 |
| AC-2: The scope did not widen too far | **Pass** | A car attachment and an expense attachment stay separate across two users; the victim's row and object are re-read each time |
| AC-3: Car photos added and removed from the form | **Pass** | Attach on create or edit, render, remove; the URL then 404s |
| AC-4: No orphaned objects on hard delete | **Pass** | `db:seed:demo --clear` deletes objects before the row. A soft-deleted car keeps its object and stops serving it |
| AC-5: The adapter works against real Supabase | **Pass — verified for real** | Upload, download with matching bytes, missing-object null, delete, delete-twice. **The bucket is private**, confirmed by unauthenticated requests to both the public and object URLs returning 400 |
| AC-6: Nothing already green went red | **Pass** | All five gates exit 0, zero warnings. 265 unit, 164 integration, 152 e2e. **CI run 31462152345 green — but with a flaky annotation on this plan's own new audit; fixed, see Deviations** |

## Verification Results

| Command | Exit | Result |
|---------|------|--------|
| `npm run check` | 0 | zero warnings |
| `npm run build` | 0 | |
| `npm test` | 0 | **265** (was 249) |
| `npm run test:integration` | 0 | **164** (was 153) |
| `npm run test:e2e` | 0 | **152** (was 144) |

**581 tests total, up from 546.**

### Mutation testing — the first clean sweep in this project

| Mutation | Result |
|----------|--------|
| Drop the **car** half of the ownership OR | **Red** (4 tests) |
| Drop the **expense** half of the OR | **Red** (5 tests) |
| Drop `deletedAt: null` from the car half | **Red** (2 tests) |

Every branch load-bearing. 03-01, 03-03, 04-01 and 04-03 each found something that was not — this is
the first time the answer came back clean, which is only meaningful because the question was asked
the same way each time.

### Real-service verification

Run against a live Supabase project: upload, download (bytes and content type intact), missing
object returning null, delete, and delete-again. Separately, the app's own data path —
`createAttachmentForCar` → `getAttachmentForUser` → `storage.get` — with a stranger refused, a
soft-deleted car ceasing to resolve while its object survives, and delete removing both.

**Bucket privacy confirmed**: unauthenticated GETs to `/storage/v1/object/public/{bucket}/{key}` and
`/storage/v1/object/{bucket}/{key}` both return 400 rather than the image.

## Accomplishments

- **Fixed a bug 04-03 could not have caught.** Car photos were unreachable by their own owner.
- **Verified the adapter against the real thing**, and found it wrong — see below.
- **Closed a hazard this plan created**, before it could touch anything real.
- **Phase 4 closes with attachments deployable**, which the local adapter never was.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Ownership is an OR over both paths, each with `deletedAt: null` | An attachment belongs to a car or an expense; scoping through `expense` alone cannot match a null `expenseId` | All three branches mutation-proven |
| A soft-deleted car stops serving its photos, but keeps the objects | Soft delete preserves history, and photographs are history | Symmetric with how its expenses become unreachable |
| No `@supabase/supabase-js` | Three REST calls do not justify the first runtime dependency since Phase 2, and an SDK would have needed the same real-service verification | `lib/storage-supabase.ts` is ~100 lines of `fetch` |
| A missing Supabase variable is a hard failure | Silently reverting to local storage in production loses every photo while each screen looks like it worked | The refusal names every missing variable |
| `attachPostedPhoto` extracted rather than copied | A second upload path is a second place to forget the byte-length check, the MIME sniff, or the size limit | One helper, two callers |
| The suites force `STORAGE_DRIVER=local` | See the hazard below | Overwritten, not defaulted — the unsafe value becomes unreachable |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 3 | One product defect found only by real verification, one hazard this plan created, one flaky test only CI saw |
| Scope additions | 2 | `playwright.config.ts`, `tests/integration/setup.ts` — both required for safety |
| Deferred | 1 | EXIF, unchanged |

### Auto-fixed Issues

**1. [defect] The Supabase adapter mishandled a missing object — found only by running it**

- **Found during:** the AC-5 checkpoint, on the first real round-trip
- **Issue:** the adapter treated HTTP 404 as "no such object", taken from the documented REST
  surface. **Real Supabase returns HTTP 400**, with the answer in the body:
  `{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}`.
  So `get()` threw where it had to return null — and `/api/attachments/[id]` turns null into a 410
  and anything else into a 500, so **a row whose object had gone would have crashed the route**.
  `delete()` had the same flaw, making a second delete throw
- **Fix:** a `classify()` helper reads the body and treats a 400 carrying that shape as not-found,
  while a 400 that is *not* that shape stays a real error. Error messages now carry a truncated body
- **Verification:** the real round-trip passes end to end. The unit tests now use the **observed**
  response, with a note to re-verify against a real project rather than trusting them
- **The lesson, plainly:** the stub passed. It passed because a stub answers whatever it is told to,
  and I told it 404. This is the fifth consecutive plan in which something believed-and-tested was
  wrong until it was executed for real

**2. [hazard] Adding `STORAGE_DRIVER` gave the test suites a path into production storage**

- **Found during:** the checkpoint, immediately after `.env` gained `STORAGE_DRIVER=supabase`
- **Issue:** `tests/integration/setup.ts` and `playwright.config.ts` both `import "dotenv/config"`,
  so the driver reached the suites. `getStorage()` would have branched to Supabase and ignored the
  per-test `STORAGE_LOCAL_ROOT` — **every attachment test writing real objects into a real bucket.**
  The Phase 8 failure mode one layer up, with an object store instead of a database
- **Fix:** both paths force `STORAGE_DRIVER=local`, overwritten rather than defaulted, in the
  Playwright workers **and** the server under test — the same two-place fix 08-01 needed for
  `DATABASE_URL`, and for the same reason
- **Verification:** objects in the real bucket **before** a full 316-test run: 1. **After**: 1. The
  guard is proven against a suite that performs about thirty photo uploads

**3. [flaky-test] The new car-edit audit reported a missing document title**

- **Found during:** AC-6's CI confirmation, run 31462152345 — green, with a flaky annotation.
  Every local run had passed, including three consecutive repeats
- **Issue:** `[serious] document-title`. Next's App Router applies `<title>` **asynchronously**
  after a client-side navigation, so axe could run in the window where the new content was on
  screen and the title was not yet set. Waiting for an element to be visible is not enough — the
  content arrives before the metadata does
- **Fix:** `expectAccessible` now polls for a non-empty `page.title()` before running axe. Applied
  in the shared helper rather than the one test, because every audited page has the same race and
  the others were simply lucky
- **Verification:** `--repeat-each=3 --retries=0` across the suite, 36/36
- **Worth keeping:** this is the second time in the phase that a green CI job with a flaky
  annotation hid a real defect. Read the ANNOTATIONS block, not the tick

### Scope Additions

`playwright.config.ts` and `tests/integration/setup.ts`, neither in `files_modified`. Both were
required by a hazard this plan introduced; shipping the driver without them would have been
shipping the hazard.

### Deferred Items

- **No EXIF stripping, including GPS.** Unchanged from 04-03, and now the open item that matters
  most: this plan is what makes deploying attachments possible.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| The Supabase dashboard offers **S3 access keys**, which suit a different protocol (SigV4-signed S3 API) | The REST adapter needs the project URL plus the **secret / service_role** key. Documented in the checkpoint instructions |
| A stray object survived the first checkpoint run — it threw between `put` and `delete` | Removed; the bucket is empty again. A reminder that a script which verifies by writing needs its cleanup outside the failure path |

## Next Phase Readiness

**Ready:**

- Attachments can be deployed. The local adapter never could — Vercel's filesystem is ephemeral
- Phase 4 is complete: installable, fast to add an expense, accessible on its audited pages, and
  photo-capable on both cars and expenses
- Phase 5 (Bulgarian integrations) depends on none of this and is gated on its own research spike

**Concerns:**

- **EXIF/GPS**, above
- **The adapter is verified once, by hand.** Nothing in CI exercises real Supabase, and nothing
  should — but that means an API change will surface in production rather than in a test run
- **Five routes remain unaudited** for accessibility, unchanged from 04-02
- **No real home-screen install** has been performed, carried from 04-01
- **`.env` now holds real Supabase credentials.** Gitignored, and `.env.example` carries only
  placeholders — but the repository is public and this is the first time real credentials for a
  hosted service exist on this machine at all

**Blockers:** None.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 04-pwa-mobile-ux, Plan: 04*
*Completed: 2026-08-10*
