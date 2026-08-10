---
phase: 04-pwa-mobile-ux
plan: 03
subsystem: database
tags: [attachments, storage, uploads, prisma, migration, check-constraint, canvas, isolation]

requires:
  - phase: 02-foundations
    provides: Expense, its scoped data layer, and the ownership pattern this copies
  - phase: 04-pwa-mobile-ux
    provides: The expense form (04-02) the photo field mounts into, and the a11y gate it joins
provides:
  - The Attachment entity, with a CHECK constraint enforcing exactly one owner
  - lib/storage.ts — an ObjectStorage interface and a local filesystem adapter
  - Browser-side photo downscaling before upload
  - /api/attachments/[id] — ownership-checked serving, 404 for everyone else
  - Object cleanup on expense deletion
affects: [04-04 Supabase adapter and car photos, 06 Google Drive export]

tech-stack:
  added: []
  patterns:
    - "A storage interface with a local adapter, so the backend is a swap not a rewrite"
    - "Three layered size limits, each with a different job"
    - "Hand-written CHECK constraint for a rule Prisma cannot express"

key-files:
  created:
    - lib/storage.ts
    - lib/attachments.ts
    - lib/image.ts
    - lib/validation/attachment.ts
    - app/expenses/../cars/[id]/expenses/attachment-field.tsx
    - app/api/attachments/[id]/route.ts
    - prisma/migrations/20260810180000_add_attachment/migration.sql
    - tests/unit/image.test.ts
    - tests/unit/storage-local.test.ts
    - tests/unit/validation-attachment.test.ts
    - tests/integration/attachments.test.ts
    - tests/e2e/attachments.spec.ts
  modified:
    - prisma/schema.prisma
    - lib/expenses.ts
    - next.config.ts
    - app/cars/[id]/expenses/actions.ts
    - app/cars/[id]/expenses/expense-form.tsx
    - app/cars/[id]/expenses/[expenseId]/edit/page.tsx
    - tests/e2e/accessibility.spec.ts
    - .gitignore
    - .env.example

key-decisions:
  - "Objects live in a gitignored .storage/, never under public/"
  - "Serving is an ownership-checked route; 404 never 403"
  - "Next's server action body limit raised to 3mb — the 1mb default silently rejected uploads"
  - "deleteExpense removes stored objects before the row the cascade would take"

patterns-established:
  - "A fixture that never exercises the branch under test proves nothing about it"
  - "toBeVisible() passes on a broken image — poll naturalWidth instead"
  - "Measure a platform limit rather than reading one number and assuming it is the only one"

duration: 75min
started: 2026-08-10T18:15:00Z
completed: 2026-08-10T19:20:00Z
description: "A photo attaches to an expense at the moment it is recorded, shrinks in the browser first, and is readable by nobody but its owner"
type: Summary
about: "gaspense"
---

# Phase 4 Plan 03: Expense Attachments

**A receipt can be photographed at the pump and attached as the expense is recorded. The browser
shrinks it first, the database enforces that it belongs to exactly one thing, and the serving route
returns 404 to everyone but its owner — including when there is no session at all.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~75 min |
| Started | 2026-08-10T18:15:00Z |
| Completed | 2026-08-10T19:20:00Z |
| Tasks | 3 of 3 completed |
| Files created | 12 |
| Files modified | 9 |
| Tests added | 56 (31 unit, 11 integration, 14 e2e) |
| Dependencies added | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Photo attached as the expense is recorded | **Pass** | One submit creates the expense and its attachment; the image is served back from `/api/attachments/...` |
| AC-2: Exactly one owner, enforced by the database | **Pass** | Raw INSERTs with both ids and with neither are rejected. **Dropping the constraint turns both tests red** |
| AC-3: Only the owner can fetch | **Pass** | 404 for another user and for no session, with an empty body. Data-layer isolation re-reads the victim's row afterwards |
| AC-4: The browser shrinks before upload | **Pass** | A 4000×3000 image arrives re-encoded as JPEG. **This AC was not genuinely proven until the fixture was replaced — see Deviations** |
| AC-5: No orphaned objects | **Pass** | Deleting the expense removes the row *and* the object; a refused delete leaves both intact |
| AC-6: Nothing already green went red | **Pass** | All five gates exit 0, zero lint warnings. 249 unit, 153 integration, 144 e2e. CI confirmation pending push |

## Verification Results

Exit codes read directly, never through a pipe:

| Command | Exit | Result |
|---------|------|--------|
| `npm run check` | 0 | zero warnings |
| `npm run build` | 0 | |
| `npm test` | 0 | **249** (was 218) |
| `npm run test:integration` | 0 | **153** (was 142) |
| `npm run test:e2e` | 0 | **144** (was 130) |

**546 tests total, up from 490.**

### Mutation testing — and the answers diverged again

| Mutation | Expected | Actual |
|----------|----------|--------|
| Drop the CHECK constraint | AC-2 red | Red, both cases |
| `getAttachmentForUser` loses its ownership filter | AC-3 red | **Red** — load-bearing |
| `deleteAttachment`'s `deleteMany` loses its filter | AC-3 red | **Green** — redundant; the `getAttachmentForUser` pre-check carries it |
| Revert `bodySizeLimit` to Next's 1 MB default | AC-4 red | Red |

The `deleteMany` filter is kept as defence in depth and **documented as redundant rather than
implied to be proven** — the fourth time in this project that the obvious check was not the
load-bearing one.

### Confirmed non-vacuously

116 objects were written to `.storage/` during the session, and `git check-ignore` refuses every
one. The rule is doing real work rather than passing against an empty directory.

## Accomplishments

- **A photo can be attached at the moment that matters**, in the same submit as the expense.
- **The storage backend is a swap, not a rewrite.** 04-04 adds a Supabase adapter behind the same
  interface; nothing above it changes.
- **"Belongs to exactly one thing" is a database rule, not a comment** — a hand-written
  `CHECK (num_nonnulls("carId", "expenseId") = 1)`, since Prisma cannot express one.
- **Three size limits, each with a different job**, discovered by measurement rather than assumed.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `.storage/` is gitignored and never under `public/` | Anything in `public/` is served statically with no session check — every photo world-readable at a guessable path | The ignore rule landed in the same commit as the adapter |
| Serving is an ownership-checked route, not a signed URL | A leaked signed URL works for anyone until it expires; here the refusal *is* the mechanism and is testable like every other scoped path | Bytes pass through the app on every view — acceptable at personal scale |
| **404, never 403** | A 403 confirms the id exists. Same reasoning as `createExpense` returning one null for two causes | Also 404 for no session, rather than a redirect that would confirm the id resolves |
| A missing object returns **410**, not 404 | That row *is* the caller's; conflating it with "not yours" would make a real inconsistency undiagnosable | Only reachable once a second backend exists |
| Keys are `randomUUID` + an extension from the validated MIME | A client filename is a path-traversal vector, and a key derived from anything knowable is guessable | The key never leaves the server |
| `serverActions.bodySizeLimit: "3mb"` | Next's 1 MB default is stricter than Vercel's 4.5 MB and rejects uploads **silently** | Found by measurement; see Deviations |
| Two writes, not one transaction | `createExpense` owns its own transaction for the odometer pairing; threading a client out for this would put test convenience into production code | If the photo fails the expense still saves, and the message says so |
| `deleteExpense` deletes objects before the row | The cascade takes the rows, after which nothing knows the keys | The one edit to a file 04-02 protected |
| Dimensions are a hint, never trusted | They only size the `<img>`; byte length and MIME are re-derived from the bytes | Prevents the layout collapsing while a photo loads |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 4 | One was a genuine product defect; two were tests that proved nothing |
| Scope additions | 1 | `next.config.ts`, required to make AC-4 work at all |
| Deferred | 2 | Logged below |

**Total impact:** No scope creep. The plan's own "measure it" verification step is what exposed a
defect that every test had been hiding.

### Auto-fixed Issues

**1. [defect] Next's 1 MB server-action body limit rejected real uploads, silently**

- **Found during:** Task 3, writing the AC-4 test with a genuinely oversized image
- **Issue:** the design was built around Vercel's 4.5 MB serverless body cap. **Next caps a server
  action's body at 1 MB by default**, which is stricter. A 4000×3000 image downscaled to 1137 KB,
  the action was rejected before it ran, and the form sat there with **no error at all** — the
  failure is invisible from the user's side
- **Fix:** `serverActions.bodySizeLimit: "3mb"` in `next.config.ts`, with the reasoning recorded
  there. It sits above the 2 MB validation limit, which stays the real limit and the one that
  produces a readable message
- **Verification:** reverting to `1mb` turns the new test red

**2. [test-validity] AC-4 was not proven at all**

- **Found during:** Task 3, before the defect above surfaced
- **Issue:** every attachment test used `public/icons/icon-192.png` — already inside the 1600px
  limit, so the downscaler took its "leave it alone" branch every time. The tests exercised the
  path that does nothing and asserted nothing about downscaling
- **Fix:** a test that generates a 4000×3000 image at run time (a screenshot of a high-frequency
  pattern — a flat colour compresses to nothing and would not test the size path), uploads it, and
  asserts the served file is re-encoded JPEG under the limit. **A real photo must never enter a
  public repository**, hence generated rather than committed
- **Why it matters:** this is what surfaced the defect above. The AC would otherwise have been
  marked Pass against a fixture that could not fail it

**3. [test-validity] `toBeVisible()` passed on a broken image**

- **Found during:** the visual check, looking at a screenshot
- **Issue:** the photo rendered as a 320×2 sliver — the image had not loaded — and the e2e
  assertion passed anyway. A permanently broken image would have passed too
- **Fix:** poll `naturalWidth > 0`, the only assertion that proves the served bytes decode. Also
  assert the `width`/`height` attributes are present

**4. [gap] `width`/`height` were never populated**

- **Found during:** the same screenshot
- **Issue:** the schema stores dimensions specifically so the `<img>` can reserve its space, and
  nothing ever wrote them — the column existed and the feature it existed for did not
- **Fix:** the field reports the decoded dimensions (including when the file is left untouched) and
  the action passes them through as an explicitly untrusted hint

### Scope Additions

**`next.config.ts`**, not in `files_modified`. Required by AC-4: without it, an oversized photo
cannot be uploaded at all.

### Deferred Items

- **No EXIF stripping, including GPS coordinates.** A canvas re-encode drops EXIF as a *side
  effect*, not a guarantee, and the no-canvas fallback path preserves it entirely. ⚠️ Settle before
  any deployment carries real photos.
- **One attachment per expense in the UI.** The schema permits many; a gallery has its own design
  questions.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `prisma migrate diff` needed a shadow database, and Prisma 7 renamed its flags (`--to-schema-datamodel` removed, no `--shadow-database-url`) | Created `gaspense_shadow` on the local container and passed `SHADOW_DATABASE_URL` through the environment, which `prisma.config.ts` already reads |
| Non-fuel e2e flows silently failed to submit | Only `?type=fuel` preselects a category, so the required select blocked submission. A helper now picks one — my test bug, not an app bug |
| `File.type` is `string`, the schema wanted the narrowed enum | The data layer takes an `UnverifiedAttachment` and narrows it itself, rather than pushing the parse out to every call site |

## Next Phase Readiness

**Ready:**

- 04-04 adds a Supabase adapter behind `ObjectStorage` and swaps the resolver — no feature code moves
- `Attachment.carId` and its CHECK constraint already exist, so car photos need no migration
- The accessibility gate covers the edit page with a photo on it

**Concerns:**

- **The local adapter is not a deployment story.** Vercel's filesystem is ephemeral, so `.storage/`
  works in development and would silently lose photos in production. **04-04 is not optional** if
  attachments are ever deployed
- **EXIF/GPS**, above — the one item here with a privacy dimension
- **`bodySizeLimit` and the downscale target are coupled.** Change the target or the JPEG quality
  and the 3 MB ceiling needs re-checking; nothing enforces the relationship
- **The app now has two client components.** Both earned it — a service worker and a canvas cannot
  run on a server — but that is the direction of travel to watch

**Blockers:** None for 04-04 beyond the Supabase project the user has taken on.

---
*Built with PAUL Framework v1.4 · https://chrisai.cv/skool · https://youtube.com/@chris-ai-systems*
*Phase: 04-pwa-mobile-ux, Plan: 03*
*Completed: 2026-08-10*
