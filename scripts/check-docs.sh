#!/usr/bin/env bash
#
# Verifies the agent-context documentation exists.
#
# Phase 0's testable criterion: this must fail loudly, naming the file, when any
# of the agent entry-point docs go missing. Phase 1's GitHub Actions workflow
# invokes it via `npm run check`.
#
# No dependencies — plain bash so CI can run it before/without a Node install.

set -euo pipefail

# Run from the repo root regardless of where this was invoked from.
cd "$(dirname "$0")/.."

REQUIRED_DOCS=(
  "CLAUDE.md"
  "AGENTS.md"
  "docs/ARCHITECTURE.md"
)

missing=0
for doc in "${REQUIRED_DOCS[@]}"; do
  if [[ ! -f "$doc" ]]; then
    echo "check-docs: MISSING required documentation file: ${doc}" >&2
    missing=$((missing + 1))
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  echo "check-docs: FAILED — ${missing} required documentation file(s) missing." >&2
  echo "check-docs: agent context is incomplete; see CLAUDE.md for what each file carries." >&2
  exit 1
fi

echo "check-docs: OK — all ${#REQUIRED_DOCS[@]} required documentation files present."
