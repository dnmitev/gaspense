import { describe, expect, it } from "vitest";
import { databaseNameFromUrl, resolveTestDatabaseUrl } from "@/tests/test-database";

const TEST_URL = "postgresql://gaspense:pw@localhost:5433/gaspense_test?schema=public";
const DEV_URL = "postgresql://gaspense:pw@localhost:5433/gaspense_dev?schema=public";

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
