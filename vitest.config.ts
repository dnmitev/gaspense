import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    // Scoped to tests/unit so Vitest never picks up Playwright's specs in
    // tests/e2e — the two runners must not collide.
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    // No `globals: true` — tests import describe/it/expect explicitly, which
    // keeps them type-safe without extra global type declarations.
  },
  resolve: {
    alias: {
      // Mirrors the "@/*" path alias in tsconfig.json.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
