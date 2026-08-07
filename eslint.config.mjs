// ESLint flat config.
//
// Phase 2 note: when Next.js lands, append its flat preset as another entry in
// the tseslint.config() call below — no restructuring should be needed.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
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
      ".paul/**",
      "projects/**",
    ],
  },

  js.configs.recommended,

  {
    // TypeScript rules apply only to TS sources. There are none yet — that is
    // expected in Phase 0 and must not fail the lint run.
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
  },

  // Must stay last: turns off stylistic rules that Prettier owns.
  prettier,
);
