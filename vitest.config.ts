import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

// Mirrors the "@/*" path alias in tsconfig.json.
const alias = { "@": repoRoot };

export default defineConfig({
  test: {
    // Two projects so the suites can run independently:
    //   npm test              → unit only, NO database required
    //   npm run test:integration → DB-backed, needs Docker Postgres
    //
    // Keeping unit tests database-free matters: the fast feedback loop must not
    // depend on a running container.
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/unit/setup.ts"],
          include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          include: ["tests/integration/**/*.{test,spec}.ts"],
          // These tests share one Postgres database and truncate between cases,
          // so they must not run in parallel with each other.
          fileParallelism: false,
          // A cold connection plus migrations can exceed the default timeout.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
