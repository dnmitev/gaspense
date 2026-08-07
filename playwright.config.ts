import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

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
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-throwaway-secret-not-real",
    },
    reuseExistingServer: !process.env.CI,
    // A production build runs first, so allow well beyond the default 60s.
    timeout: 180_000,
  },
});
