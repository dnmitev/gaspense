/**
 * Calls the REAL vignette service and prints what the client made of it.
 *
 *   npm run verify:vignette -- --plate XX0000XX
 *
 * ## Why this exists as a tracked script
 *
 * 04-04 shipped a Supabase adapter whose stub-based unit tests all passed while
 * the adapter was wrong: the real service reported a missing object as HTTP 400
 * with the status buried in the body, so `get` threw where it had to return null.
 * A stub answers whatever it is told. This is the only check that can catch that
 * class of error, and making it a command rather than a one-off means it can be
 * re-run whenever `lib/vignette.ts` changes.
 *
 * ⚠️ **The plate is an argument — never a default, never committed.** This is a
 * public repository and a real licence plate is personal data.
 *
 * ⚠️ **Nothing automated calls this.** The test suites force the stub driver; a CI
 * run has no business calling a public government endpoint.
 */

import { createVignetteClient } from "@/lib/vignette";

function plateFromArgv(): string {
  const index = process.argv.indexOf("--plate");
  const value = index === -1 ? undefined : process.argv[index + 1];

  if (!value) {
    console.error(
      "Usage: npm run verify:vignette -- --plate <LICENCE PLATE>\n\n" +
        "Calls check.bgtoll.bg for real. Try a plate you expect to have a vignette\n" +
        "and one you expect not to, and compare both against the fixtures in\n" +
        "tests/unit/vignette.test.ts.",
    );
    process.exit(1);
  }

  return value;
}

const plate = plateFromArgv();

// The live client explicitly, not getVignetteClient() — this script exists to
// exercise the real service, so reading VIGNETTE_DRIVER from the environment
// would let a stray `stub` in .env make it verify nothing at all.
const result = await createVignetteClient().check(plate);

console.log(`plate:  ${plate}`);
console.log(`result: ${result.kind}`);

if (result.kind === "active") {
  console.log(`  validFrom:      ${result.validFrom}`);
  console.log(`  validUntil:     ${result.validUntil}`);
  console.log(`  vignetteNumber: ${result.vignetteNumber}`);
  console.log(`  exempt:         ${result.exempt}`);
}

if (result.kind === "unavailable") {
  console.log(`  reason: ${result.reason}`);
  console.log(
    "\n⚠️  'unavailable' means the response could not be trusted — NOT that there is\n" +
      "    no vignette. If this is unexpected, the endpoint's shape may have changed;\n" +
      "    re-check it against .paul/phases/05-bulgarian-integrations/DISCOVERY.md.",
  );
}
