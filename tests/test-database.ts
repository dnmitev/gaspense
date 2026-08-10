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
 * workflow already points `DATABASE_URL` at `gaspense_test`. `assertTestDatabase`
 * below is what makes that fallback safe rather than merely convenient — a
 * fallback onto a production `DATABASE_URL` is refused.
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

/**
 * Hosts a destructive test operation is allowed to run against.
 *
 * Exported so the error message and the tests read the rule from one place
 * instead of restating it and drifting apart.
 */
export const ALLOWED_TEST_HOSTS = ["localhost", "127.0.0.1", "::1"] as const;

/** A database name must end in this to be considered a test database. */
export const TEST_DATABASE_SUFFIX = "_test";

/** The hostname, with the brackets `new URL()` leaves around IPv6 literals removed. */
function hostnameOf(parsed: URL): string {
  return parsed.hostname.replace(/^\[|\]$/g, "");
}

/**
 * Refuses to proceed unless the URL is demonstrably a test database.
 *
 * A precondition for anything destructive — `resetDatabase()` truncates five
 * tables and has no way of its own to know what it is aimed at.
 *
 * Two conditions, **both** required:
 *   - the host is local (`localhost`, `127.0.0.1`, `::1`)
 *   - the database name ends in `_test`
 *
 * Both rather than either, because a real database can satisfy one by accident.
 * Checked against the four connection strings this project actually uses:
 * CI (`localhost` + `gaspense_test`) and the local test database pass; the local
 * development database fails on the name; a Supabase URL fails on both.
 *
 * There is deliberately no override flag. An `ALLOW_DESTRUCTIVE_TESTS`-style
 * variable gets set once in `.env` and forgotten, so it stays true when the shell
 * later points somewhere real — it detaches the permission from the target, which
 * is the one thing this must not do. Safety is derived from the connection string
 * because the connection string is what determines the danger.
 */
export function assertTestDatabase(url: string): void {
  const refuse = (reason: string): never => {
    throw new Error(
      [
        `Refusing a destructive operation: ${reason}`,
        `URL host must be one of ${ALLOWED_TEST_HOSTS.join(", ")} and the database name must end in "${TEST_DATABASE_SUFFIX}".`,
        "Set TEST_DATABASE_URL to your test database and run: npm run db:test:setup",
        "There is no override — see tests/test-database.ts for why.",
      ].join("\n"),
    );
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return refuse(`"${url}" is not a usable connection URL`);
  }

  const host = hostnameOf(parsed);
  if (!ALLOWED_TEST_HOSTS.includes(host as (typeof ALLOWED_TEST_HOSTS)[number])) {
    return refuse(`host "${host}" is not local`);
  }

  const name = databaseNameFromUrl(url);
  if (name === null) {
    return refuse(`"${url}" names no database`);
  }
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    return refuse(`database "${name}" is not a test database`);
  }
}
