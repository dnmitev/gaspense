import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { createTestClient, resetDatabase } from "./helpers";

/**
 * Watches the guard refuse.
 *
 * A safety check nobody has seen fail is not a safety check — it is a comment
 * that happens to compile. These cases drive `resetDatabase` at targets it must
 * reject and assert it rejects them.
 *
 * ⚠️ Every case here is chosen so that a BROKEN guard still destroys nothing:
 *
 *   - The production case points at an unreachable host, so nothing is reached.
 *   - The local cases use the `postgres` maintenance database, which contains
 *     none of this application's tables — a TRUNCATE that got through would fail
 *     on a missing relation rather than delete anything.
 *
 * The obvious test — point it at `gaspense_dev` and watch it refuse — is the one
 * test that must never be written here. If the guard regresses, that test
 * destroys precisely the data this phase exists to protect.
 *
 * Because refusal is asserted by message, a guard failure is distinguishable
 * from an incidental error ("relation does not exist"), which is the whole point
 * of matching on the message rather than merely expecting a throw.
 */

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

/** Local, reachable, real — and not test-named. Holds no application tables. */
function maintenanceUrl(): string {
  const parsed = new URL(ORIGINAL_DATABASE_URL ?? "");
  parsed.pathname = "/postgres";
  parsed.search = "";
  return parsed.toString();
}

function clientFor(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

afterEach(() => {
  // Restore before the next case, so a mutation here cannot leak into the rest
  // of the run — every other spec in this suite reads this variable.
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

afterAll(() => {
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe("resetDatabase guard", () => {
  it("refuses a production-shaped URL without opening a connection", async () => {
    // Unreachable on purpose. If the guard ran *after* connecting we would get
    // "Can't reach database server"; getting the guard's own message instead is
    // what proves it is a precondition.
    process.env.DATABASE_URL = "postgresql://postgres:pw@db.unreachable-host.invalid:5432/postgres";
    const prisma = clientFor(process.env.DATABASE_URL);

    try {
      await expect(resetDatabase(prisma)).rejects.toThrow(/Refusing a destructive operation/);
      await expect(resetDatabase(prisma)).rejects.toThrow(/not local/);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("refuses a local database whose name is not test-shaped", async () => {
    process.env.DATABASE_URL = maintenanceUrl();
    const prisma = clientFor(process.env.DATABASE_URL);

    try {
      await expect(resetDatabase(prisma)).rejects.toThrow(/not a test database/);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("refuses when the connection disagrees with DATABASE_URL", async () => {
    // The gap the URL check alone cannot close: the string is a perfectly good
    // test database, but the client is attached somewhere else entirely.
    const prisma = clientFor(maintenanceUrl());

    try {
      await expect(resetDatabase(prisma)).rejects.toThrow(/not connected to the database/);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("refuses to even build a client against a non-test database", async () => {
    // Found by running the misconfiguration deliberately: guarding truncation
    // alone stopped the data loss but still let specs write rows into
    // gaspense_dev before they reached the refusal. Refusing at construction
    // means nothing is written to a database the suite does not own.
    process.env.DATABASE_URL = maintenanceUrl();

    expect(() => createTestClient()).toThrow(/not a test database/);
  });

  it("still truncates the real test database", async () => {
    // The positive control. Without it, a guard that refused everything would
    // pass every case above and the suite would look healthy while being inert.
    const prisma = createTestClient();

    try {
      await prisma.user.create({ data: { email: `guard-${Date.now()}@example.test` } });
      expect(await prisma.user.count()).toBeGreaterThan(0);

      await resetDatabase(prisma);

      expect(await prisma.user.count()).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
