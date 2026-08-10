import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { assertTestDatabase, databaseNameFromUrl } from "../test-database";

/**
 * A client for integration tests. Deliberately not the `lib/prisma.ts`
 * singleton — tests should own their connection lifecycle and disconnect
 * cleanly rather than share a cached global.
 *
 * Guarded as well as `resetDatabase`, and for a reason found by running the
 * misconfiguration on purpose: with `TEST_DATABASE_URL` unset and `DATABASE_URL`
 * pointed at `gaspense_dev`, the truncate was correctly refused — but specs had
 * already *written* rows to the development database before reaching that
 * refusal. Guarding truncation alone stops the data loss and permits the
 * pollution.
 *
 * Refusing here moves the failure to module scope, where a spec file cannot load
 * at all against the wrong database. That is the earliest and loudest place for
 * it, and it means zero writes reach a database the suite does not own.
 */
export function createTestClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  assertTestDatabase(url);

  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

/**
 * Truncates every table so each test starts from a known state.
 *
 * Without this a suite only passes on a fresh database, which is not a suite.
 * CASCADE handles the foreign keys; RESTART IDENTITY is harmless with cuid PKs
 * but keeps the behaviour predictable if a serial column is ever added.
 *
 * Guarded twice, and both halves are load-bearing:
 *
 *   1. `assertTestDatabase` refuses a URL that is not local and `_test`-named.
 *   2. `current_database()` must match that URL's database name.
 *
 * (1) alone guards a *string* while the TRUNCATE hits a *connection* — a client
 * built from some other URL would sail straight past it. (2) ties the approved
 * string to the live session, which is why the guard lives here at the
 * destructive call rather than in `createTestClient()`.
 *
 * Known limit: (2) compares the database *name*, not the host. Postgres cannot
 * report the client-side host it was reached on — `inet_server_addr()` returns
 * the server's own address, which is a container IP here. The name match plus
 * `createTestClient()` being the suite's only client builder is what closes it.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";

  // Before connecting, not after: a production URL must be refused without a
  // packet being sent.
  assertTestDatabase(url);

  const expected = databaseNameFromUrl(url);
  const [{ current_database: actual }] = await prisma.$queryRaw<
    [{ current_database: string }]
  >`SELECT current_database()`;

  if (actual !== expected) {
    throw new Error(
      [
        "Refusing to truncate: the client is not connected to the database that was checked.",
        `DATABASE_URL names "${expected}" but the connection reports "${actual}".`,
        "Guarding the URL would be meaningless if the truncate hit a different connection.",
      ].join("\n"),
    );
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Expense", "OdometerReading", "Car", "Category", "User" RESTART IDENTITY CASCADE;`,
  );
}
