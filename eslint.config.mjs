// ESLint flat config.
//
// eslint-config-next@16 exports a flat-config array directly (3 entries, each
// self-scoped via its own `files` patterns), so it spreads in without
// FlatCompat. It contributes 22 @next/next rules plus react, react-hooks,
// import, and jsx-a11y.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // .paul/** is PAUL-managed and projects/** is an append-only ideation
    // record — neither is ours to lint or reformat.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "lib/generated/**",
      ".paul/**",
      "projects/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
  },

  // Next.js: React, hooks, a11y, and framework-specific correctness rules.
  ...next,

  // Must stay last: turns off stylistic rules that Prettier owns.
  prettier,
);
