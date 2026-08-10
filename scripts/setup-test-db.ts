/**
 * Creates and migrates the database the test suites own.
 *
 * Run with: npm run db:test:setup
 *
 * Idempotent by design — the common case is re-running it after a fresh clone or
 * after `docker compose down -v`, where "already there" must be a quiet success
 * rather than an error.
 *
 * Why a script and not a `/docker-entrypoint-initdb.d/` file: Postgres runs those
 * only against a fresh volume. On an existing volume the init script would do
 * nothing while reading like it worked, and forcing it to take effect means
 * `docker compose down -v` — wiping the development data this whole phase exists
 * to protect.
 *
 * Runs under tsx like every other script here: Prisma 7's generated client uses
 * bundler-style extensionless imports that Node's own ESM loader cannot resolve.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { databaseNameFromUrl, resolveTestDatabaseUrl } from "../tests/test-database";

/**
 * Postgres has no `CREATE DATABASE IF NOT EXISTS`, and the name goes into the
 * statement as an identifier rather than a bindable parameter. Rather than
 * escaping arbitrary input, refuse anything that is not a plain identifier —
 * a database name needing quotes is a sign the URL is not what was intended.
 */
const SAFE_NAME = /^[A-Za-z0-9_]+$/;

/** The maintenance database to connect to in order to issue CREATE DATABASE. */
function maintenanceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  parsed.search = "";
  return parsed.toString();
}

async function main(): Promise<void> {
  const url = resolveTestDatabaseUrl(process.env);
  const name = databaseNameFromUrl(url);

  if (name === null) {
    throw new Error(`Could not read a database name from the test database URL: ${url}`);
  }
  if (!SAFE_NAME.test(name)) {
    throw new Error(
      `Refusing to create a database named "${name}" — expected letters, digits and underscores only.`,
    );
  }

  const client = new Client({ connectionString: maintenanceUrl(url) });

  try {
    await client.connect();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not connect to Postgres to create "${name}".\n` +
        `Is the local database running? Start it with: docker compose up -d\n` +
        `Underlying error: ${reason}`,
    );
  }

  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`db:test:setup: created database "${name}".`);
    } else {
      console.log(`db:test:setup: database "${name}" already exists — nothing to create.`);
    }
  } finally {
    await client.end();
  }

  // `migrate deploy`, never `migrate dev`: deploy is the non-interactive command
  // and will not try to generate new migrations. prisma.config.ts reads
  // DATABASE_URL, and its `dotenv/config` does not override an already-set
  // variable — so passing it here wins over whatever .env says.
  console.log(`db:test:setup: applying migrations to "${name}"...`);
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  if (migrate.status !== 0) {
    throw new Error(`prisma migrate deploy failed with exit code ${migrate.status}.`);
  }

  console.log(`db:test:setup: "${name}" is ready.`);
}

main().catch((error: unknown) => {
  console.error(`db:test:setup: FAILED\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
