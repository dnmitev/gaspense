import { describe, expect, it } from "vitest";
import {
  assertTestDatabase,
  databaseNameFromUrl,
  resolveTestDatabaseUrl,
} from "@/tests/test-database";

const TEST_URL = "postgresql://gaspense:pw@localhost:5433/gaspense_test?schema=public";
const DEV_URL = "postgresql://gaspense:pw@localhost:5433/gaspense_dev?schema=public";

// Copied verbatim from .github/workflows/ci.yml. Pinned here so that changing the
// workflow's connection string without re-checking the guard breaks a test rather
// than breaking CI — the guard was designed around this exact value.
const CI_URL = "postgresql://gaspense:gaspense_ci@localhost:5432/gaspense_test?schema=public";

// Shaped like the Supabase connection .env.example tells you to use for
// migrations: remote host, database "postgres". The state this guard exists for.
const PRODUCTION_URL = "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres";

describe("resolveTestDatabaseUrl", () => {
  it("prefers TEST_DATABASE_URL when both are set", () => {
    // The ordering that makes an exported production DATABASE_URL inert. If this
    // ever inverts, the suites become able to truncate whatever the shell is
    // pointing at — the exact failure Phase 8 exists to remove.
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: TEST_URL, DATABASE_URL: DEV_URL })).toBe(
      TEST_URL,
    );
  });

  it("falls back to DATABASE_URL when TEST_DATABASE_URL is unset", () => {
    // This fallback is what lets CI pass with no workflow edit: the workflow sets
    // DATABASE_URL to gaspense_test and never sets TEST_DATABASE_URL.
    expect(resolveTestDatabaseUrl({ DATABASE_URL: TEST_URL })).toBe(TEST_URL);
  });

  it("falls back when TEST_DATABASE_URL is present but empty", () => {
    // An empty variable is what a half-filled .env produces. Treating "" as set
    // would hand Prisma an empty connection string instead of a usable one.
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: "", DATABASE_URL: TEST_URL })).toBe(
      TEST_URL,
    );
  });

  it("throws naming both variables when neither is set", () => {
    // Must throw, not return undefined: Prisma reads an undefined connection
    // string as "resolve it yourself" and connects somewhere unannounced.
    expect(() => resolveTestDatabaseUrl({})).toThrow(/TEST_DATABASE_URL/);
    expect(() => resolveTestDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });

  it("throws when both are present but empty", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: "", DATABASE_URL: "" })).toThrow(
      /db:test:setup/,
    );
  });
});

describe("databaseNameFromUrl", () => {
  it("strips the query string", () => {
    // `?schema=public` is on every URL in this project, so a naive split on "/"
    // would yield "gaspense_test?schema=public" and never match current_database().
    expect(databaseNameFromUrl(TEST_URL)).toBe("gaspense_test");
  });

  it("reads the name from a URL with no query string", () => {
    expect(databaseNameFromUrl("postgresql://user:pw@localhost:5433/gaspense_dev")).toBe(
      "gaspense_dev",
    );
  });

  it("returns null for a string that is not a URL", () => {
    expect(databaseNameFromUrl("not-a-url")).toBeNull();
  });

  it("returns null when the URL carries no database name", () => {
    expect(databaseNameFromUrl("postgresql://user:pw@localhost:5433")).toBeNull();
    expect(databaseNameFromUrl("postgresql://user:pw@localhost:5433/")).toBeNull();
  });
});

describe("assertTestDatabase", () => {
  it("allows the local test database", () => {
    expect(() => assertTestDatabase(TEST_URL)).not.toThrow();
  });

  it("allows a loopback IP with a _test name", () => {
    expect(() =>
      assertTestDatabase("postgresql://gaspense:pw@127.0.0.1:5433/anything_test"),
    ).not.toThrow();
  });

  it("allows an IPv6 loopback literal", () => {
    // new URL() keeps the brackets on the hostname; without stripping them the
    // host comparison silently fails and the guard refuses a legitimate target.
    expect(() => assertTestDatabase("postgresql://gaspense:pw@[::1]:5433/x_test")).not.toThrow();
  });

  it("allows CI's connection string exactly as the workflow sets it", () => {
    // The whole reason .github/workflows/ci.yml needs no edit for this phase.
    expect(() => assertTestDatabase(CI_URL)).not.toThrow();
  });

  it("refuses the development database", () => {
    // The near-miss that actually matters: right host, wrong database. This is
    // the run that wiped the signed-in account twice in one session.
    expect(() => assertTestDatabase(DEV_URL)).toThrow(/gaspense_dev/);
  });

  it("refuses a production-shaped URL", () => {
    expect(() => assertTestDatabase(PRODUCTION_URL)).toThrow(/not local/);
  });

  it("refuses a remote host even when the name ends in _test", () => {
    // Why the rule is host AND name rather than either: a name alone must not be
    // enough to reach across the network.
    expect(() => assertTestDatabase("postgresql://u:pw@db.example.com:5432/gaspense_test")).toThrow(
      /not local/,
    );
  });

  it("refuses a local host whose name is not test-shaped", () => {
    expect(() => assertTestDatabase("postgresql://u:pw@localhost:5433/postgres")).toThrow(
      /not a test database/,
    );
  });

  it("refuses a string that is not a URL", () => {
    expect(() => assertTestDatabase("not-a-url")).toThrow(/not a usable connection URL/);
  });

  it("refuses a URL that names no database", () => {
    expect(() => assertTestDatabase("postgresql://u:pw@localhost:5433")).toThrow(/names no/);
  });

  it("tells you how to fix it", () => {
    // Whoever meets this error is mid-mistake and needs the way out, not a
    // statement of policy.
    expect(() => assertTestDatabase(DEV_URL)).toThrow(/TEST_DATABASE_URL/);
    expect(() => assertTestDatabase(DEV_URL)).toThrow(/db:test:setup/);
  });
});
