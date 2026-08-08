import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../lib/generated/prisma/client";
import { seedDefaultCategories } from "../../../lib/seed-categories";

/**
 * Ensures the system-default categories exist before an e2e run needs them.
 *
 * The expense form offers categories with `userId: null`, which are global rows
 * created by `npm run db:seed` rather than by anything the app does at runtime.
 * The integration suite truncates `Category`, and CI runs integration tests
 * immediately before e2e — so without this the select renders empty and every
 * expense test fails, reproducibly in CI and only intermittently in local runs
 * where leftover seed data happens to survive.
 *
 * Idempotent: `seedDefaultCategories` uses `skipDuplicates`, so calling it in a
 * `beforeEach` is safe and costs one no-op insert.
 */
export async function ensureSystemCategories(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await seedDefaultCategories(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
