import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { resolveTestDatabaseUrl } from "./tests/test-database";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// The e2e helpers write directly to the database while the server under test
// reads from it, so both must be the same one — and it must be the database the
// suites own, never the development one. `dotenv/config` above has already
// populated process.env by the time this runs.
const TEST_DATABASE_URL = resolveTestDatabaseUrl(process.env);

// Overwrite the variable, not just pass it to the server below.
//
// Setting webServer.env alone covers the server and leaves the HELPERS behind:
// tests/e2e/helpers/auth.ts and tests/e2e/helpers/categories.ts build their own
// clients from process.env.DATABASE_URL, and they run in Playwright's worker
// processes rather than in the server. Split-brain is silent and total — the
// helper writes a Session row to one database, the server looks it up in the
// other, finds nothing, redirects to /signin, and every spec times out waiting
// for content it will never see.
//
// Playwright loads this config in each worker, so assigning here reaches them.
process.env.DATABASE_URL = TEST_DATABASE_URL;

// ⚠️ Same reasoning for attachment storage. A developer's .env may set
// STORAGE_DRIVER=supabase, and `dotenv/config` above puts it in this process —
// which would make every e2e photo upload write real objects into a real bucket.
// Forced local here (for the workers) and in webServer.env below (for the server
// under test); both are needed, exactly as they were for DATABASE_URL in 08-01.
process.env.STORAGE_DRIVER = "local";

export default defineConfig({
  // Scoped so Playwright never picks up Vitest's specs in tests/unit.
  testDir: "tests/e2e",

  // A `.only` left in a spec silently narrows the suite — fail the CI run
  // instead of quietly passing a subset.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Mobile-first is a stated project convention, so the small viewport is
      // a first-class test target rather than an afterthought.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    // Production build, deliberately NOT `next dev`. Next 16's dev server
    // regenerates the nextjs-agent-rules block in AGENTS.md on every run, which
    // would leave the working tree dirty after every test invocation and fight
    // the pre-push hook. Verified in plan 02-02 that `next build` has no such
    // side effect.
    command: "npm run build && npm start",
    url: BASE_URL,
    // The server needs the database and a session secret. AUTH_SECRET only has
    // to exist for NextAuth to boot; this value is deliberately throwaway and
    // is never used against a real provider.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-throwaway-secret-not-real",
      // Required. `next start` runs in production mode, where Auth.js refuses to
      // infer the host and fails every session read with UntrustedHost. Dev mode
      // trusts localhost automatically, which is why this only shows up against a
      // production build. Narrower than setting trustHost: true globally.
      AUTH_URL: BASE_URL,
      // Never the real object store. See the note above process.env.STORAGE_DRIVER.
      STORAGE_DRIVER: "local",
    },
    // Never reuse a server this config did not start. A local `npm run dev` serves
    // the DEVELOPMENT database, while the helpers above write to the TEST one —
    // reusing it would exercise the wrong database and pass. It also upholds the
    // decision above that e2e serves the production build and never `next dev`,
    // which reusing a dev server quietly undermined.
    //
    // Consequence: a local run now fails loudly when port 3000 is occupied instead
    // of silently reusing whatever is there. That is the deferred hard-coded-port
    // issue surfacing honestly, and is better than a green run against dev data.
    reuseExistingServer: false,
    // A production build runs first, so allow well beyond the default 60s.
    timeout: 180_000,
  },
});
