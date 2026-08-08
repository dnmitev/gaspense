---
description: "gaspense — current position and accumulated context"
type: ProjectState
about: "gaspense"
---

# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-08-07)

**Core value:** Track the real total cost of vehicle ownership in one place with actual reporting, instead of scattered receipts and memory.
**Current focus:** v0.1 Initial Release, Phase 2: Foundations — 5 of 6 plans complete

## Current Position

Milestone: v0.1 Initial Release (v0.1.0)
Phase: 2 of 7 (Foundations) — In progress
Plan: 02-05 complete (loop closed)
Status: Ready for next PLAN (02-06 — the last of Phase 2)
Last activity: 2026-08-07 — Closed loop 02-05; cars usable end to end, 79 tests green

Progress:
- Milestone: [██░░░░░░░░] 29% (2 of 7 phases complete)
- Phase 2: [████████░░] 83% (5 of 6 plans)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — ready for next PLAN]
```

## Performance Metrics

8 plans complete, ~3.5h total, ~26 min average.

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 00-ai-friendly-scaffolding | 2/2 ✅ | ~11 min |
| 01-cicd-pipeline | 1/1 ✅ | ~29 min |
| 02-foundations | 5/6 | ~31 min |

**Trend:** 13, 9, 29, 33, 14, 35, 45, 28 min. Cost tracks how much *unknown third-party
behaviour* a plan touches, not its size — 02-05 was the largest by files yet mid-pack, because
the stack was already understood.

## Accumulated Context

### Decisions

Only what constrains upcoming work. **Full log (28 entries): `.paul/PROJECT.md` -> Key Decisions.**

| Decision | Impact on what comes next |
|----------|---------------------------|
| Isolation is app-layer, not RLS | **02-04/05/06: every query path needs a test proving one user cannot read another's rows.** No database backstop exists |
| Money is `amountCents Int` | Every UI and report must divide by 100 to display, multiply on input. One missed conversion is a 100x error |
| Soft-delete cars only (`deletedAt`) | Every car query must filter `deletedAt: null`; expenses/odometer hard-delete |
| Schema is 5 entities | Phase 4 adds Attachment; Phase 5 adds Fine/Vignette after the research spike |
| Prisma 7: adapter mandatory, URLs in `prisma.config.ts` | Never `new PrismaClient()` bare; never put `url`/`directUrl` in the schema |
| Prisma scripts run under `tsx` | The generated client's imports are bundler-style and extensionless |
| Unit tests DB-free; integration separate | `npm test` must keep passing with Docker stopped |
| CLAUDE.md and AGENTS.md always change together | One set of facts in two files |
| Direct commits to `main`; push after every loop | No branch protection -- the pre-push hook is the only pre-landing gate |
| Public repo -- nothing sensitive, ever | `.env.example` placeholders only; no real plates or personal data in seeds/fixtures |
| NextAuth **v5 beta** + `@auth/prisma-adapter`, database sessions | v5 is beta but is the App Router API; sessions live in Postgres so Phase 6 gets the Google refresh token free |
| Google OAuth credentials are the user's to create | Automated tests create sessions directly in the DB; a real login is a manual check the user performs |
| **`lib/session.ts` is the only way to learn the caller** | `requireUserId()` throws rather than returning falsy — Prisma reads `undefined` in `where` as "no filter", so a nullable helper would leak every user's rows |
| **Mutations are server actions, not REST routes** | Reads in server components, writes in actions over a scoped data layer. `docs/ARCHITECTURE.md`'s REST table was a design sketch and gets corrected in 02-05 |
| **Hand-rolled Tailwind, no component library** | Ideation's "Tailwind + shadcn" predates any UI; adopt shadcn only when a dialog/date-picker genuinely needs it |
| **Data-layer functions take `userId` explicitly** | They never read the session themselves — keeps them unit-testable and makes a missing filter visible at the call site |
| **Writes use scoped `updateMany`, never findUnique-then-update** | Putting `userId` in the same WHERE clause as the id means a wrong owner affects zero rows; find-then-update is where cross-user writes leak |
| **`AUTH_URL` is required for a production build** | Auth.js rejects every session read with UntrustedHost otherwise. Dev mode trusts localhost, so this only appears against `next start` |
| **Verify e2e with `CI=true`** | `reuseExistingServer` can silently reuse a stale dev server, so a plain local pass proves nothing about CI |
| **Assert against comment-stripped source** | Four checks in 02-05 matched explanatory comments, not code. Counting occurrences is weaker than checking each function |
| **Vertical-slice pattern is set** | validation -> scoped data layer -> server actions -> server-component UI -> isolation tests -> authenticated e2e. 02-06 copies it |

### Deferred Issues

| Issue | Origin | Effort | Revisit |
|-------|--------|--------|---------|
| Bulgarian fines/vignette lookup mechanism unconfirmed | Ideation | M | Before Phase 5 — `/paul:discover` |
| Fines/vignette check cadence undecided | Ideation | S | After the Phase 5 spike |
| Licence unsettled — `UNLICENSED` avoids npm's default ISC grant on a public repo | Phase 0 | S | User's call, any time |
| Non-provider secret-scanning patterns unavailable — needs GitHub's paid Secret Protection tier | Phase 1 | — | Only under org licensing |

### Blockers/Concerns

| Concern | Impact | Resolution Path |
|---------|--------|-----------------|
| Next.js owns a section of AGENTS.md | Hand-edits inside the `nextjs-agent-rules` block are silently overwritten on `next dev` | Edit only outside the markers |
| e2e step rebuilds the app, duplicating the Build step | Slower CI runs | Accepted; optimising means touching 01-01's verified workflow structure |
| Auth is wired but never exercised against real Google | A real OAuth login has not been performed; seeded DB sessions are what the tests use | User adds `AUTH_*` to `.env` and clicks through when convenient |
| e2e suite asserts placeholder copy on `/` | Phase 3 turns `/` into the dashboard and will need `tests/e2e/home.spec.ts` updated | Expected, not a regression |
| **No money formatting helper exists yet** | 02-06 is the first money UI; inlining `/100` at each call site invites a missed conversion | Add a formatter with its own unit tests |
| No accessibility audit has been run | WCAG AA is a stated goal; fields are labelled but contrast/focus/keyboard are unverified | Dedicated pass once the UI stops growing |

**Resolved:** CI metric + stale agent docs (02-02); `.env.example` + ARCHITECTURE schema (02-03);
the `@auth/prisma-adapter`/Prisma 7 worry — its peer range is open-ended, and compatibility was
verified functionally (02-04); PROJECT.md duplication (02-04 planning).

## Boundaries (Active)

Standing "do not break these":

- **All data paths go through `lib/session.ts`** — never build a `where` from a nullable user id
- **No Google Drive scopes** in the OAuth consent until Phase 6
- **No real credentials committed** — `AUTH_*` real values live only in `.env`

- **Never run `prisma init` again** -- re-injects 71 agent-skill files and edits `.gitignore`
- **Never run `create-next-app`** here -- clobbers README.md, .gitignore, eslint.config.mjs, scripts
- **Never edit inside AGENTS.md's `nextjs-agent-rules` markers** -- Next regenerates that block
- **Keep `afterEach(cleanup)` in `tests/unit/setup.ts`** -- looks like boilerplate, prevents DOM leaks
- ESLint stays on 9 -- `eslint-config-next`'s plugins crash on 10
- CI triggers, `permissions`, `concurrency` -- verified in 01-01, not to be restructured
- `.paul/**`, `projects/**`, `.claude/settings.json` -- untouched by tooling
- `npm run check` must stay green; the pre-push hook enforces it

### Git State

Branch: `main` · Feature branches: none (direct-to-`main` workflow)

## Session Continuity

Last session: 2026-08-07 (resumed; handoff consumed and archived to `.paul/handoffs/archive/`)
Stopped at: Plan 02-05 loop closed — all 7 ACs pass; cars usable end to end
Next action: Run `/paul:plan` for 02-06 — Category, Expense, and Odometer CRUD. **This closes Phase 2.**
Resume file: `.paul/phases/02-foundations/02-05-SUMMARY.md`
Git strategy: `main` (direct commits)
Resume context:
- Phase 2 is 5 of 6 — **02-06 is the last plan**, so closing it WILL trigger the mandatory phase transition. The file-count heuristic has false-positived six times; ROADMAP remains the authority.
- **02-06 copies 02-05's vertical slice**: `lib/cars.ts`, `app/cars/actions.ts`, and `tests/integration/cars.test.ts` are the templates.
- **02-06 is the first money-facing UI.** Add a formatting helper with unit tests rather than inlining `amountCents / 100` at each call site.
- E2E auth is solved: `tests/e2e/helpers/auth.ts` seeds a session and sets the cookie.
- Local dev needs `docker compose up -d` (Postgres on **5433**) before `npm run test:integration`.
- **Never read an exit code through a pipe** -- this has caused a wrong conclusion three times.

---
*STATE.md — Updated after every significant action*
*Size target: <100 lines (digest, not archive)*
