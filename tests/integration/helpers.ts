import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * A client for integration tests. Deliberately not the `lib/prisma.ts`
 * singleton — tests should own their connection lifecycle and disconnect
 * cleanly rather than share a cached global.
 */
export function createTestClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/**
 * Truncates every table so each test starts from a known state.
 *
 * Without this a suite only passes on a fresh database, which is not a suite.
 * CASCADE handles the foreign keys; RESTART IDENTITY is harmless with cuid PKs
 * but keeps the behaviour predictable if a serial column is ever added.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Expense", "OdometerReading", "Car", "Category", "User" RESTART IDENTITY CASCADE;`,
  );
}
