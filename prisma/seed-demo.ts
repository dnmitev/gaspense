import "dotenv/config";
import { parseArgs } from "node:util";
import { clearDemoData, seedDemoData } from "../lib/seed-demo";

// Thin runner — the logic lives in lib/seed-demo.ts so integration tests can
// import it without executing a script, matching prisma/seed.ts.
//
// Run via tsx, not bare node: Prisma 7's generated client uses bundler-style
// extensionless internal imports that Node's own ESM loader cannot resolve.
//
// Argument parsing uses node:util's parseArgs rather than a dependency. It has
// been available since Node 18 and this project's floor is 22.

const USAGE = `
Usage: npm run db:seed:demo -- --email <address> [--anchor YYYY-MM-DD] [--clear]

  --email   The account to attach demo data to. Required.
            You must have signed in with Google at least once; this command
            attaches to an existing account and never creates one.
  --anchor  Date the history ends on. Defaults to today, so the current month
            always has data. Pin it for reproducible output.
  --clear   Remove the demo car instead of creating it.

Note: 'npm run test:integration' truncates the tables and will wipe this data.
Re-run the command afterwards. Phase 8 addresses that properly.
`.trim();

/**
 * Parses an anchor date, rejecting anything Date would silently accept as
 * Invalid Date — a bad --anchor must fail here rather than produce a year of
 * NaN-dated rows.
 */
function parseAnchor(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`--anchor must be YYYY-MM-DD, got "${value}"`);
  }

  const anchor = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(anchor.getTime())) {
    throw new Error(`--anchor is not a real date: "${value}"`);
  }

  return anchor;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      anchor: { type: "string" },
      clear: { type: "boolean", default: false },
    },
  });

  if (!values.email) {
    console.error(USAGE);
    process.exit(1);
  }

  if (values.clear) {
    const result = await clearDemoData({ email: values.email });

    console.log(
      result.removed > 0
        ? `seed:demo: removed the demo car and everything on it`
        : `seed:demo: nothing to remove`,
    );
    return;
  }

  // Defaults to today so "this month" is never empty on a fresh seed. The
  // dataset itself is a pure function of this value — see lib/demo-data.ts.
  const anchor = values.anchor ? parseAnchor(values.anchor) : new Date();

  const result = await seedDemoData({ email: values.email, anchor });

  if (result.replaced) console.log("seed:demo: replaced the existing demo car");
  console.log(
    `seed:demo: ${result.expenses} expenses and ${result.readings} manual readings ` +
      `through ${anchor.toISOString().slice(0, 10)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
