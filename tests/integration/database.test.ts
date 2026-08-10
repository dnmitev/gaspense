import { afterAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { databaseNameFromUrl, resolveTestDatabaseUrl } from "../test-database";
import { createTestClient } from "./helpers";

/**
 * Proves the suite is connected where it believes it is.
 *
 * `resetDatabase()` truncates whatever the client is attached to, so "which
 * database is this?" is the question the whole suite rests on. Every other spec
 * here answers it implicitly; this one answers it out loud.
 *
 * Assert against `current_database()` — what Postgres reports about the live
 * connection — rather than against `process.env.DATABASE_URL`. Reading the
 * variable back would only prove that `setup.ts` ran, not that Vitest's
 * setupFiles ordering actually beats the module-scope `createTestClient()` calls
 * in every other file. That ordering is the assumption this plan rests on, and it
 * is exactly the kind of assumption that breaks silently on a tooling upgrade.
 */

const prisma: PrismaClient = createTestClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("test database wiring", () => {
  it("is connected to the database the resolver names", async () => {
    const expected = databaseNameFromUrl(resolveTestDatabaseUrl(process.env));
    expect(expected).not.toBeNull();

    const [{ current_database: actual }] = await prisma.$queryRaw<
      [{ current_database: string }]
    >`SELECT current_database()`;

    expect(actual).toBe(expected);
  });

  it("is not connected to the development database", async () => {
    // The named failure this phase exists to prevent. `gaspense_dev` is where the
    // signed-in Google account and the demo dataset live; truncating it cost a
    // re-login and a re-seed twice in one session.
    const [{ current_database: actual }] = await prisma.$queryRaw<
      [{ current_database: string }]
    >`SELECT current_database()`;

    expect(actual).not.toBe("gaspense_dev");
  });
});
