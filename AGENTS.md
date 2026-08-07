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

| Purpose                  | Command                |
| ------------------------ | ---------------------- |
| **All gates (this one)** | **`npm run check`**    |
| Dev server               | `npm run dev`          |
| Production build         | `npm run build`        |
| Serve production build   | `npm start`            |
| Unit + integration tests | `npm test`             |
| End-to-end tests         | `npm run test:e2e`     |
| Lint code                | `npm run lint`         |
| Lint markdown            | `npm run lint:md`      |
| Format                   | `npm run format`       |
| Check formatting         | `npm run format:check` |

`npm run check` is the docs + style gate: it verifies the agent docs exist, then runs
`format:check`, `lint`, and `lint:md`. Run it before committing — the pre-push hook runs it anyway.

Runtime dependencies are Next.js and React. Supabase and NextAuth arrive in later Phase 2 plans
(02-03 and 02-04); there is no database or auth yet.

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
- **Unit tests use Vitest with `globals: false`**, so Testing Library's cleanup is wired manually in
  `tests/unit/setup.ts`. Without it each test's DOM leaks into the next and queries start matching
  elements from earlier tests.
- **Secret scanning and push protection are active.** GitHub itself rejects a push containing a
  recognised secret. Treat that as a safety net, not a strategy: never write a real credential to a
  file in the first place.

## Code Conventions

- **TypeScript throughout.** No plain-JS source files.
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
