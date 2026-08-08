# Architecture

Design reference for Gaspense — data model, API surface, and phase roadmap.

> **This is a living document.** Update it as the design evolves. It describes the _design_, not the current implementation state.
>
> `.paul/ROADMAP.md` is the authority on phase status. The phase table below is a summary for orientation, not a progress tracker.

Related: [README.md](../README.md) (project brief) · [CLAUDE.md](../CLAUDE.md) / [AGENTS.md](../AGENTS.md) (agent instructions) · [projects/gaspense/PLANNING.md](../projects/gaspense/PLANNING.md) (full ideation record)

---

## System Overview

A single Next.js application serves both the UI and the API routes, deployed on Vercel. Supabase provides PostgreSQL and object storage. Google is the sole identity provider, and the same OAuth consent is reused for the Google Drive export feature.

```text
   ┌─────────────────────────────────┐
   │  Next.js app (Vercel)           │
   │  ┌───────────┐  ┌────────────┐  │
   │  │ PWA UI    │─▶│ API routes │  │
   │  └───────────┘  └─────┬──────┘  │
   └───────────────────────┼─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐   ┌────────────────┐   ┌──────────────┐
  │ Supabase  │   │ Google         │   │ КАТ/МВР +    │
  │ Postgres  │   │ OAuth + Drive  │   │ vignette     │
  │ + Storage │   │                │   │ (unconfirmed)│
  └───────────┘   └────────────────┘   └──────────────┘
```

There is no separate backend service, no cache layer, and no real-time transport — a personal logging app does not need them.

---

## Data Model

**Implemented: five entities.** Three more are designed but deliberately deferred — see
[Deferred entities](#deferred-entities) below. The authoritative source is
[`prisma/schema.prisma`](../prisma/schema.prisma); this section describes it.

```text
User ──< Car ──< Expense >── Category
              └─< OdometerReading
```

| Entity              | Key fields                                                                                                                                                       | Relationships                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **User**            | `id` (cuid), `email` (unique), `name?`, `emailVerified?`, `image?`, timestamps                                                                                   | has many Cars and Categories                                   |
| **Car**             | `id`, `userId`, `licensePlate`, `make?`, `model?`, `year?`, `nickname?`, `fuelType` (enum), **`deletedAt?`** (soft delete), timestamps                           | belongs to User; has many Expenses and OdometerReadings        |
| **Category**        | `id`, `userId?` (null = system default), `name`, timestamps                                                                                                      | belongs to User (optional); has many Expenses                  |
| **Expense**         | `id`, `carId`, `categoryId`, `date`, **`amountCents`** (Int), `notes?` — fuel expenses additionally carry `liters?` (Float), `station?`, `fullTank?`, timestamps | belongs to Car and Category                                    |
| **OdometerReading** | `id`, `carId`, `date`, `reading` (Int, km), `source` (enum `MANUAL` \| `EXPENSE`), **`expenseId?`** (unique, cascade), timestamps                                | belongs to Car; optionally to the Expense it was captured with |

**Enums:** `FuelType` (PETROL, DIESEL, LPG, ELECTRIC, HYBRID, OTHER) and
`OdometerSource` (MANUAL, EXPENSE).

**Indexes:** `Car(userId)`, `Car(deletedAt)`, `Category(userId)`, `Expense(carId)`,
`Expense(date)`, `Expense(categoryId)`, `OdometerReading(carId)`, `OdometerReading(date)`, plus the
two partial unique indexes described below.

### Design decisions behind this shape

- **Odometer readings are a first-class log**, not derived from expenses. Fuel fill-ups are an
  incomplete record of mileage, and accurate L/100km — plus future service-interval reminders —
  needs a standalone series.
- **A reading may point at the expense it was captured with** (`OdometerReading.expenseId`,
  nullable and unique, `ON DELETE CASCADE`). The `source: EXPENSE` enum value records only that a
  reading came from _some_ fill-up, which is not enough to keep the pair consistent: matching back
  on `(carId, date)` is ambiguous — two fill-ups in one day is ordinary — and editing an expense's
  date would orphan its reading. The cascade matters because a reading must never outlive the
  fill-up it claims to measure; a stale one would silently corrupt the consumption series computed
  from consecutive full-tank readings.
- **Soft delete on Car only** (`deletedAt`). Deleting a car must never destroy its expense history,
  so every car query must filter `deletedAt: null`. Expenses and odometer readings hard-delete;
  they are cheap to re-enter. Integration tests assert this distinction.
- **Money is stored as `amountCents` (integer minor units), not a decimal.** _This deviates from the
  original design, which said `amount` (EUR)._ Prisma's `Decimal` returns Decimal.js instances that
  do not survive the Next.js server→client boundary as numbers, forcing serialisation everywhere.
  Integer cents gives exact arithmetic and makes Phase 3's `SUM()` reporting trivial. EUR-only makes
  a single minor unit safe.
- **`pricePerLiter` is not stored.** _Also a deviation from the original design._ It is
  `amountCents / liters`, and a stored derived value can drift from its inputs — compute it where
  displayed. `liters` is a `Float` rather than a decimal because, unlike money, no exact-cent
  arithmetic depends on it.
- **Categories are seeded but user-editable.** Defaults: Fuel, Maintenance, Body Work, Insurance,
  Taxes/Fees, Fines, Vignette, Parking, Tires, Other. `Category.userId` is null for system defaults.
- **Two partial unique indexes enforce category uniqueness**, written as raw SQL in the migration
  because Prisma cannot express partial indexes: `name` unique `WHERE userId IS NULL` (system
  defaults) and `(userId, name)` unique `WHERE userId IS NOT NULL` (a user's own). A plain
  `@@unique([userId, name])` would **not** work — Postgres treats NULLs as distinct, so duplicate
  system defaults would be permitted and `upsert` could never match them.

### Authentication tables (adapter-owned)

Written and read by NextAuth's Prisma adapter — do not hand-edit their field names, which are
snake_case because the adapter stores OAuth response fields verbatim.

| Entity                | Purpose                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **Account**           | One row per linked OAuth provider. **`refresh_token` here is what Phase 6's Drive export depends on.** |
| **Session**           | Database session strategy — a row means a live login, which is what makes sessions revocable.          |
| **VerificationToken** | Unused with Google-only sign-in, but required by the adapter's interface.                              |

`User` gained only Prisma-level relation fields (`accounts`, `sessions`); the migration adding these
tables altered no existing column.

**`@auth/prisma-adapter` and Prisma 7:** the adapter's peer range reads
`@prisma/client >=2.26.0 || >=3 || …`, which looks like an enumeration of majors but is open-ended,
so 7.x satisfies it. Compatibility was nonetheless verified functionally in
`tests/integration/adapter.test.ts`, which exercises `createUser`, `linkAccount`, `createSession`,
`getSessionAndUser`, and cascade deletion against the real database.

### Deferred entities

| Entity         | Deferred to | Why                                                                                                                                                                                    |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fine**       | Phase 5     | Its fields depend on what the КАТ/МВР research spike finds the service actually returns. Modelling it now would be speculation likely contradicted later.                              |
| **Vignette**   | Phase 5     | Same reason — the vignette check has no confirmed API either.                                                                                                                          |
| **Attachment** | Phase 4     | Arrives with car/expense photo upload. Design stands: nullable dual foreign keys (`carId`/`expenseId`), with the file body in Supabase Storage and only `storagePath` in the database. |

Prisma migrations are additive, so adding these later is a normal migration rather than a rewrite.

### Data layer

- **Prisma 7** with the **`@prisma/adapter-pg` driver adapter** — Prisma 7 requires either a driver
  adapter or Prisma Accelerate; the client can no longer read a connection URL from the schema.
- **Connection URLs live in [`prisma.config.ts`](../prisma.config.ts)**, not `schema.prisma`. Prisma 7
  removed `url` and `directUrl` from the datasource block.
- **`lib/prisma.ts`** exports a singleton cached on `globalThis` outside production, so Next's dev
  hot-reload does not exhaust the connection pool. The adapter also accepts a `pg.Pool`, which is the
  lever for tuning serverless pooling when the app is deployed.
- **Local development uses Docker Postgres** ([`docker-compose.yml`](../docker-compose.yml), host port 5433) and CI uses a service container. Supabase is the production target; nothing is wired to it yet.

---

## Data Access and API Surface

Application data is read in **server components** and written through **server actions** over a
scoped data layer. There is no REST API for the app's own entities, because the app is its only
client.

> **Superseded:** earlier versions of this document listed nine REST route groups (`/api/cars`,
> `/api/expenses`, and so on). That was a design-time sketch written before any UI existed; it was
> never built. Server actions replaced it in plan 02-05, `/api/expenses` in 02-06, and
> `/api/categories` and `/api/odometer` in 02-07. The genuinely-HTTP endpoints are listed below.

### How a data path is built

```text
page / form  →  server action        →  lib/<entity>.ts        →  Prisma
                requireUserId()         takes userId as its
                validates with Zod      first argument
```

- **`lib/session.ts` is the only way to learn who is asking.** `requireUserId()` either returns a
  real id or throws — never `null` or `undefined`. That matters because Prisma treats `undefined` in
  a `where` clause as _"no condition"_ rather than _"match nothing"_, so a nullable helper would
  silently turn a scoped query into an unscoped one.
- **Data-layer functions take `userId` explicitly** and never read the session themselves. The
  scoping is therefore visible at the call site, and the functions stay unit-testable without
  mocking auth.
- **Writes to existing rows use a scoped `updateMany`**, never `findUnique`-then-`update`. Putting
  the `userId` in the same WHERE clause as the id means a mismatched owner affects zero rows in one
  statement; the find-then-update shape is where cross-user writes leak in, because the second call
  addresses the row by id alone.
- **Server action return values must be plain serialisable objects** — they cross the
  server/client boundary, so no `Error` or Zod error instances.

#### Expenses are scoped through their car, not a column

`Expense` has **no `userId` column**. Its only link to an owner is `Expense.carId → Car.userId`, so
every filter reaches through the relation:

```ts
where: {
  id: expenseId, car: { userId, deletedAt: null }
}
```

This is the fact about the schema most likely to be misread, and getting it wrong does not produce a
type error — it produces a query that returns everybody's rows. Two consequences worth knowing
before touching `lib/expenses.ts`:

- **`updateMany` and `deleteMany` accept relation filters**, so the scoped-write pattern above
  survives unchanged (verified against the generated Prisma 7 types, where `ExpenseWhereInput`
  exposes `car`).
- **`create` has no WHERE clause**, so ownership of `carId` — and visibility of `categoryId` — must
  be checked explicitly before inserting. That check in `lib/expenses.ts` is the one place in the
  codebase where scoping is a check rather than a filter, and therefore the one place it can be
  forgotten. Without it, a forged `carId` in a form post attaches an expense to a stranger's car.

#### Categories: one table, two sets of rows

`Category.userId` is nullable, where `null` means a shared system default seeded for everyone.

**Reads span both sets** (`OR: [{ userId }, { userId: null }]`). **Writes never do.** Every write
filters `where: { id, userId }` with a real user id, which cannot match a row whose `userId` is
NULL — so a system category is unreachable through the ordinary code path. There is deliberately no
`if (category.userId === null) reject` guard: the scoping already covers it, and a special case
would imply the general rule needs supervision. `tests/integration/categories.test.ts` is what
confirms the general rule is actually sufficient.

Two constraints here are invisible to Prisma's types and must be handled as ordinary outcomes
rather than crashes:

- The partial unique indexes are **raw SQL**, so a duplicate name surfaces only as **P2002** at
  write time. Adding a category you already have is a normal mistake, not an exception.
- `Expense.category` is **`onDelete: Restrict`**, so deleting a category still in use surfaces as
  **P2003**. The data layer counts the referencing expenses first and refuses with that count.
  Reassigning them automatically is deliberately not offered: silently moving someone's records
  while they asked to delete a label is a bigger action than the one they requested.

#### Money

`amountCents` is an integer and **`lib/money.ts` is the only place euros and cents convert**. A
missed ÷100 is a 100× error that produces a plausible-looking number, so nothing crashes and the
report is simply wrong. Sum the integers, format once, and never inline the arithmetic — including
in tests.

### Isolation

**Every data path is scoped by the authenticated `userId`, enforced in application code with no
database backstop.** This project uses NextAuth rather than Supabase Auth, so there is no Postgres
Row Level Security underneath: a query that omits its `userId` filter returns every user's rows.

Isolation is therefore covered by tests, not intention.
`tests/integration/isolation.test.ts` and `tests/integration/cars.test.ts` prove that cross-user
read, update, and soft-delete all fail — each asserting the victim's row is unchanged afterwards,
not merely that the call returned nothing. **Every new scoped helper gets a matching leakage test.**

### HTTP endpoints

| Route                     | Purpose                                                   | Status                  |
| ------------------------- | --------------------------------------------------------- | ----------------------- |
| `/api/auth/[...nextauth]` | NextAuth handlers (Google sign-in, session, callbacks)    | **Built** (02-04)       |
| `/api/fines/check`        | Trigger an external КАТ fines lookup, rate-limited        | Phase 5, research-gated |
| `/api/vignette/check`     | Trigger an external vignette validity check, rate-limited | Phase 5, research-gated |
| `/api/export/gdrive`      | Trigger an export/backup to the user's Google Drive       | Phase 6                 |

These are endpoints rather than actions because each triggers an outbound call to a third party, not
a CRUD write. There are no public endpoints — the app is authenticated end to end.

### Auth

NextAuth v5 with the Google provider and **database sessions** (a `Session` row means a live login,
which makes sessions revocable). Input is validated with Zod at every action boundary.

---

## Phase Roadmap

Seven phases toward the v0.1 release. See `.paul/ROADMAP.md` for status, dependencies, and plans.

| Phase | Name                            | Goal                                                                                                   |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **0** | AI-Friendly Project Scaffolding | Any agent or contributor opening the repo has full context and consistent style without re-deriving it |
| **1** | CI/CD Pipeline                  | Lint, test, and build gate every merge to `main`; the public repo is protected against leaked secrets  |
| **2** | Foundations                     | A user can log in, add a car, and record expenses against categories                                   |
| **3** | Reporting                       | A user can see fuel cost per month/year and a cost breakdown by category                               |
| **4** | PWA & Mobile UX                 | The app installs on a phone home screen and adding an expense takes seconds                            |
| **5** | Bulgarian Integrations          | A user can check outstanding fines and vignette validity per car                                       |
| **6** | Google Drive Export             | A user can export their data to their own Google Drive on demand                                       |

Every phase ships with unit, integration, and automation (e2e) tests.

---

## Known Unknowns

**The Bulgarian fines and vignette lookups have no confirmed public API.** Neither the traffic police (КАТ/МВР) fines lookup nor the vignette validity check is known to expose a documented, stable REST endpoint.

Phase 5 is therefore gated on a research spike (`/paul:discover`) that must establish, before any implementation:

- the actual callable mechanism (endpoint, or whether scraping is the only option)
- required identifiers (license plate alone? plate plus registration document number?)
- authentication, if any
- rate limits and terms of use
- a fallback if nothing stable exists (e.g. manual entry only)

Do not invent endpoint URLs or request shapes for these services. Until this section is updated with researched findings, treat the integration as unspecified.

Two smaller open questions, tracked in `.paul/STATE.md`:

- Should fines/vignette checks run on a schedule, or only on manual trigger? (Depends on the rate limits found above.)
- Hard delete or soft delete for cars and their expense history?
