import type { PrismaClient } from "@/lib/generated/prisma/client";

/// System-default categories, seeded with userId = null so every user sees them.
/// No real personal data here — this is a public repository.
/**
 * The seeded category the fuel entry form preselects.
 *
 * Named rather than written as a literal in the UI so the two cannot drift. It
 * is safe for the form to match on this name because it only ever looks at
 * SYSTEM rows (`userId: null`), which no user can rename — a user's own
 * categories are a separate set.
 */
export const FUEL_CATEGORY_NAME = "Fuel";

export const DEFAULT_CATEGORIES = [
  FUEL_CATEGORY_NAME,
  "Maintenance",
  "Body Work",
  "Insurance",
  "Taxes/Fees",
  "Fines",
  "Vignette",
  "Parking",
  "Tires",
  "Other",
] as const;

/**
 * Inserts the system-default categories, safe to run repeatedly.
 *
 * Idempotency comes from `skipDuplicates` compiling to ON CONFLICT DO NOTHING,
 * which respects the partial unique index `Category_name_system_key`
 * (unique on name WHERE userId IS NULL).
 *
 * A plain `upsert` would not work here: that index is raw SQL in the migration
 * and therefore invisible to Prisma's type-level unique tracking. And a plain
 * `@@unique([userId, name])` would not work either — Postgres treats NULLs as
 * distinct, so two ("Fuel", NULL) rows would both be permitted.
 *
 * Lives in lib/ rather than prisma/seed.ts so tests can import it without
 * triggering a script's top-level side effects.
 */
export async function seedDefaultCategories(prisma: PrismaClient): Promise<number> {
  const result = await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ name, userId: null })),
    skipDuplicates: true,
  });

  return result.count;
}
