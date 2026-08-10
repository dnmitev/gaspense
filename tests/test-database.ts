/**
 * Which database the test suites own.
 *
 * The ordering contract is the whole point: `TEST_DATABASE_URL` wins over
 * `DATABASE_URL` precisely so that an exported production `DATABASE_URL` is
 * inert. `.env.example` documents pointing `DATABASE_URL` at the Supabase direct
 * connection to run migrations — that is exactly the shell state in which the
 * integration suite used to be able to truncate production.
 *
 * The fallback to `DATABASE_URL` exists so CI passes with no workflow change: the
 * workflow already points `DATABASE_URL` at `gaspense_test`. Plan 08-02 adds the
 * guard that refuses a target which is not demonstrably a test database, which is
 * what makes that fallback safe rather than merely convenient.
 *
 * Imported by `tests/integration/setup.ts` and by `playwright.config.ts`, so both
 * suites resolve the same way from one place.
 */

const MISSING_URL_MESSAGE = [
  "No database URL for the test suites.",
  "Set TEST_DATABASE_URL (preferred) or DATABASE_URL in .env — see .env.example.",
  "Create and migrate the test database with: npm run db:test:setup",
].join("\n");

/**
 * Resolves the connection string the test suites should use.
 *
 * Takes an env-like record rather than reading `process.env` directly so it is
 * unit-testable without mutating the real environment.
 *
 * Throws rather than returning undefined: Prisma treats an undefined connection
 * string as "resolve it yourself", which is the silent behaviour this phase exists
 * to end. A loud failure here is the entire value of the function.
 */
export function resolveTestDatabaseUrl(env: Record<string, string | undefined>): string {
  const preferred = env.TEST_DATABASE_URL;
  if (preferred !== undefined && preferred !== "") {
    return preferred;
  }

  const fallback = env.DATABASE_URL;
  if (fallback !== undefined && fallback !== "") {
    return fallback;
  }

  throw new Error(MISSING_URL_MESSAGE);
}

/**
 * The database name from a connection URL — the path minus its leading slash,
 * with any query string discarded (`.../gaspense_test?schema=public` →
 * `gaspense_test`).
 *
 * Returns null for anything unparseable rather than throwing, so callers decide
 * what an unusable URL means in their context.
 */
export function databaseNameFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const name = parsed.pathname.replace(/^\//, "");
  return name === "" ? null : name;
}
