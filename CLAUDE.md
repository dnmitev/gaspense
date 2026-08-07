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

| Purpose                  | Command                |
| ------------------------ | ---------------------- |
| **All gates (this one)** | **`npm run check`**    |
| Lint code                | `npm run lint`         |
| Lint markdown            | `npm run lint:md`      |
| Format                   | `npm run format`       |
| Check formatting         | `npm run format:check` |

`npm run check` is the gate CI runs: it verifies the agent docs exist, then runs
`format:check`, `lint`, and `lint:md`. Run it before committing.

**Not available yet** — these arrive in Phase 2 with Next.js, so do not run or suggest them:

| Purpose                  | Command            | Arrives |
| ------------------------ | ------------------ | ------- |
| Dev server               | `npm run dev`      | Phase 2 |
| Production build         | `npm run build`    | Phase 2 |
| Unit + integration tests | `npm test`         | Phase 2 |
| End-to-end tests         | `npm run test:e2e` | Phase 2 |

There is deliberately no `test` script yet — a no-op passing one would give CI a false green.

Only lint/format tooling is installed; there are no runtime dependencies. Next.js, React,
Supabase, and NextAuth all arrive in Phase 2.

## CI and Quality Gates

- **CI runs `npm run check`** on every push to `main` and on every PR to `main`, via
  `.github/workflows/ci.yml`. It installs with `npm ci` on Node 22.
- **A pre-push hook runs the same gate locally**, so failures are caught before anything reaches
  GitHub (`.githooks/pre-push`). It activates automatically on `npm install` via the `prepare`
  script — a fresh clone needs no manual `git config`.
- **Deliberate bypass:** `git push --no-verify`. Use it sparingly; CI still catches the problem
  afterwards.
- **There is no branch protection.** Direct pushes to `main` are authorised, which is exactly why
  the local hook exists — CI alone reports _after_ code has already landed.
- **Secret scanning and push protection are active.** GitHub itself rejects a push containing a
  recognised secret. Treat that as a safety net, not a strategy: never write a real credential to
  a file in the first place.
- **No `test` or `build` step in CI yet.** Those scripts arrive in Phase 2; the workflow gains
  steps for them at that point.

## Conventions

- **TypeScript throughout.** No plain-JS source files.
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
