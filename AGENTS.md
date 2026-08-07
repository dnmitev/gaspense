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
