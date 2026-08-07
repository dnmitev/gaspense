import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.).
// The /vitest entry point is the Vitest-specific one — the bare import targets
// Jest and will not register with Vitest's expect.
import "@testing-library/jest-dom/vitest";

// Testing Library's automatic cleanup only registers itself when Vitest's
// globals are enabled. This config deliberately keeps `globals: false` for
// explicit, type-safe imports, so cleanup has to be wired up by hand —
// otherwise each test's DOM leaks into the next and queries start matching
// elements rendered by earlier tests.
afterEach(() => {
  cleanup();
});
