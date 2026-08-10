import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedDemoData } from "../../lib/seed-demo";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

/**
 * The project's first accessibility audit. WCAG AA is a stated goal and nothing
 * had ever been checked before this file existed.
 *
 * ## Why a dependency
 *
 * `@axe-core/playwright` is the first dependency this project has taken purely
 * for testing since Playwright itself. Computing contrast ratios and reasoning
 * about accessible names by hand is exactly what a tool does reliably and a
 * person does not — and "we asserted a few landmarks once" is not an audit.
 *
 * ## Why the gate is serious + critical only
 *
 * A gate that fails the build on an advisory gets switched off within a month,
 * and then nothing is gated at all. Moderate and minor findings are printed and
 * recorded in the plan summary instead, so "we found none" and "we gated on
 * none" stay distinguishable.
 *
 * ## Scope, stated honestly
 *
 * Four pages, on both the mobile and desktop projects. Contrast and target size
 * are viewport-dependent, so a desktop-only audit would miss the mobile problems
 * — which are the ones that matter for a phone-first app.
 *
 * NOT yet audited: /cars, /cars/new, the edit pages, /categories, and the report
 * and odometer pages. Named here and in CLAUDE.md so the gap is visible rather
 * than implied by a file called "accessibility".
 */

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

type Violation = {
  id: string;
  impact?: string | null;
  help: string;
  nodes: { target: unknown[] }[];
};

/** Runs axe and splits the findings into what gates and what is merely recorded. */
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations as unknown as Violation[];

  const blocking = violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const advisory = violations.filter(
    (violation) => violation.impact !== "serious" && violation.impact !== "critical",
  );

  return { blocking, advisory };
}

/**
 * Formats findings for the failure message.
 *
 * An axe failure reading only "expected 1 to be 0" costs an hour to diagnose, so
 * the rule id, its impact and the offending selector all go in the message.
 */
function describe(violations: Violation[]): string {
  return violations
    .map(
      (violation) =>
        `[${violation.impact}] ${violation.id}: ${violation.help}\n    ` +
        violation.nodes.map((node) => JSON.stringify(node.target)).join("\n    "),
    )
    .join("\n");
}

async function expectAccessible(page: Page, label: string) {
  const { blocking, advisory } = await audit(page);

  if (advisory.length) {
    // Recorded, not gated. Visible in the test output on a passing run.
    console.log(`[a11y advisory] ${label}: ${advisory.length}\n${describe(advisory)}`);
  }

  expect(blocking, `serious/critical violations on ${label}:\n${describe(blocking)}`).toEqual([]);
}

test.describe("accessibility — signed out", () => {
  test("sign-in page has no serious or critical violations", async ({ page }) => {
    // The first page anyone ever sees, and the only one reachable without auth.
    await page.goto("/signin");
    await expectAccessible(page, "/signin");
  });
});

test.describe("accessibility — signed in", () => {
  let seeded: SeededUser;

  test.beforeEach(async ({ context, baseURL }) => {
    seeded = await seedUserWithSession();
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });
    await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
  });

  test.afterEach(async () => {
    await deleteSeededUser(seeded.userId);
  });

  test("the dashboard has no serious or critical violations", async ({ page }) => {
    await page.goto("/");
    // Populated, not empty: the chart, the card actions and the money figures
    // are the things with contrast and naming to get wrong.
    await expect(page.getByText("DEMO-0001")).toBeVisible();
    await expectAccessible(page, "/ (populated dashboard)");
  });

  test("the quick-add fuel form has no serious or critical violations", async ({ page }) => {
    await page.goto("/expenses/new?type=fuel");
    // ⚠️ Waits on the raw #amount element, NOT getByLabel. A label-based
    // precondition depends on the very association being audited: when it broke
    // during the positive-control check, this test failed on the wait and axe
    // never ran at all. The audit must still reach axe on a page whose labels
    // are broken — that is the case it exists for.
    await expect(page.locator("#amount")).toBeVisible();
    await expectAccessible(page, "/expenses/new?type=fuel");
  });

  test("the per-car fuel form has no serious or critical violations", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /^Add fuel for / })
      .first()
      .click();

    await expect(page.locator("#amount")).toBeVisible();
    await expectAccessible(page, "/cars/[id]/expenses/new?type=fuel");
  });

  test("the edit page with a photo has no serious or critical violations", async ({ page }) => {
    // Added in 04-03. An <img> is exactly what this gate is good at: a missing
    // or unhelpful alt is a serious violation, and a photo whose contents
    // nothing can know is precisely where that gets fudged.
    await page.goto("/");
    await page
      .getByRole("link", { name: /^All expenses for / })
      .first()
      .click();

    await page.getByRole("link", { name: "Edit" }).first().click();
    await page.getByLabel(/^Photo/).setInputFiles("public/icons/icon-192.png");
    await page.getByRole("button", { name: "Save changes" }).click();

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page.getByRole("region", { name: "Photos" }).getByRole("img")).toBeVisible();

    await expectAccessible(page, "/cars/[id]/expenses/[expenseId]/edit (with a photo)");
  });
});
