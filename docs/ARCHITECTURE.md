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

Eight entities. Ownership flows `User → Car → {Expense, OdometerReading, Fine, Vignette, Attachment}`, with `Category` classifying expenses and `Attachment` hanging off either a car or an expense.

```text
User ──< Car ──< Expense >── Category
              ├─< OdometerReading
              ├─< Fine
              ├─< Vignette
              └─< Attachment >── Expense
```

| Entity              | Key fields                                                                                                                                                          | Relationships                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **User**            | `id`, `email`, `name`, `googleId`                                                                                                                                   | has many Cars                                                                                             |
| **Car**             | `id`, `userId`, `licensePlate`, `make`, `model`, `year`, `fuelType`, `nickname`                                                                                     | belongs to User; has many Expenses, OdometerReadings, Fines, Attachments; has one current Vignette status |
| **Category**        | `id`, `userId` (nullable for system defaults), `name`, `type`                                                                                                       | has many Expenses                                                                                         |
| **Expense**         | `id`, `carId`, `categoryId`, `date`, `amount` (EUR), `odometerReading`, `notes` — fuel expenses additionally carry `liters`, `pricePerLiter`, `station`, `fullTank` | belongs to Car and Category; has many Attachments                                                         |
| **OdometerReading** | `id`, `carId`, `date`, `reading`, `source` (manual / expense)                                                                                                       | belongs to Car                                                                                            |
| **Fine**            | `id`, `carId`, `source` (`"KAT"`), `amount`, `date`, `referenceNumber`, `status`                                                                                    | belongs to Car; populated via external check                                                              |
| **Vignette**        | `id`, `carId`, `validFrom`, `validTo`, `checkedAt`, `status`                                                                                                        | belongs to Car; populated via external check                                                              |
| **Attachment**      | `id`, `carId` (nullable), `expenseId` (nullable), `storagePath`, `uploadedAt`                                                                                       | belongs to either a Car or an Expense; file lives in Supabase Storage                                     |

### Design decisions behind this shape

- **Odometer readings are a first-class log**, not derived from expenses. Fuel fill-ups are an incomplete record of mileage, and accurate L/100km — plus future service-interval reminders — needs a standalone series.
- **`Attachment` uses nullable dual foreign keys** (`carId` / `expenseId`) rather than a polymorphic join table. With exactly two possible owners, this is the simpler shape; exactly one of the two should be set.
- **Amounts are EUR only.** No currency column, no conversion. Deliberate scope reduction.
- **Categories are seeded but user-editable.** Defaults: Fuel, Maintenance, Body Work, Insurance, Taxes/Fees, Fines, Vignette, Parking, Tires, Other. `Category.userId` is null for the system defaults and set for user-added ones.
- **Only the file body lives in Storage.** The database holds `storagePath`; Supabase Storage holds the bytes.

Column types, indexes, constraints, and migrations are decided in Phase 2 when the schema is actually built — deliberately not specified here.

---

## API Surface

REST via Next.js API routes. Auth is NextAuth with the Google provider and a JWT session.

**Every route is scoped by the authenticated `userId`.** A user must only ever be able to read or write their own cars, expenses, and attachments — there are no cross-user reads, and no endpoint accepts a caller-supplied user identifier to widen the scope.

| Route group          | Methods                  | Auth     | Purpose                                                 |
| -------------------- | ------------------------ | -------- | ------------------------------------------------------- |
| `/api/cars`          | GET, POST, PATCH, DELETE | required | Car CRUD                                                |
| `/api/expenses`      | GET, POST, PATCH, DELETE | required | Expense CRUD, filterable by car / category / date       |
| `/api/categories`    | GET, POST, PATCH, DELETE | required | Category CRUD (system defaults + user-added)            |
| `/api/odometer`      | GET, POST                | required | Odometer log per car                                    |
| `/api/reports`       | GET                      | required | Aggregations: cost per month/year, per category, per km |
| `/api/fines`         | GET, POST `/check`       | required | Stored fines, plus trigger an external КАТ lookup       |
| `/api/vignette`      | GET, POST `/check`       | required | Stored vignette status, plus trigger an external check  |
| `/api/attachments`   | POST, DELETE             | required | Upload / delete car and expense photos                  |
| `/api/export/gdrive` | POST                     | required | Trigger an export/backup to the user's Google Drive     |

- **No public endpoints.** This is a private, authenticated app end to end.
- **`/api/fines/check` and `/api/vignette/check` are rate-limited.** They call external government services; unthrottled or looped calls are unacceptable.
- Input is validated with a schema validator (Zod) at every boundary — amounts, dates, and license plate format especially.

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
