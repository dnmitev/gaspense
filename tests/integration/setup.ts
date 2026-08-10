// Loads DATABASE_URL from .env for local runs. In CI the variable is already
// present in the environment, and dotenv does not override existing values, so
// this is safe in both places — no dotenv CLI wrapper needed.
import "dotenv/config";
import { resolveTestDatabaseUrl } from "../test-database";

// Aim every client in this run at the database the suites own, and overwrite the
// variable rather than exporting a second one.
//
// Overwriting is the point. `tests/integration/helpers.ts` builds its client from
// process.env.DATABASE_URL, and so do tests/e2e/helpers/auth.ts and
// tests/e2e/helpers/categories.ts — a future spec that constructs its own client
// inherits the safety instead of having to remember a helper. After this line the
// original value is unreachable for the rest of the run, so an exported
// production DATABASE_URL cannot be connected to even by accident.
//
// `resetDatabase()` truncates whatever this resolves to. Plan 08-02 adds the
// guard that refuses a target which is not demonstrably a test database.
process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env);
