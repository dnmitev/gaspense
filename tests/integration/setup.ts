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

// ⚠️ And aim storage at the local adapter, for exactly the same reason.
//
// `STORAGE_DRIVER=supabase` in a developer's .env reaches this process through
// `dotenv/config` above. Without this line `getStorage()` would branch to
// Supabase and ignore the per-test `STORAGE_LOCAL_ROOT`, so every attachment
// test would write real objects into a real bucket — the Phase 8 failure mode
// one layer up, with an object store instead of a database.
//
// Overwritten rather than defaulted, so the unsafe value is unreachable for the
// rest of the run.
process.env.STORAGE_DRIVER = "local";

// ⚠️ And never let the suites call the real vignette service.
//
// `check.bgtoll.bg` is a public government endpoint. A test run that depends on
// it is flaky and rude, and the МВР service in the same family is throttled.
// Unlike STORAGE_DRIVER — whose safe value is the default — VIGNETTE_DRIVER
// defaults to `live`, because a stub default would show fabricated vignette
// dates in production. So the suites must opt IN to the stub, here and in
// playwright.config.ts. Overwritten rather than defaulted, so a value from .env
// is unreachable for the rest of the run.
process.env.VIGNETTE_DRIVER = "stub";
