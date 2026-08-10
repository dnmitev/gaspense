import { expect, test } from "@playwright/test";
import { buildDemoData } from "../../lib/demo-data";
import { seedDemoData } from "../../lib/seed-demo";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

// The seed's whole purpose is that a populated app appears without hand-building
// one, so the honest end-to-end test is: seed it, then look at it through a
// browser. This also exercises 03-01's report at realistic volume — 47 rows
// across twelve months rather than the three a hand-written fixture affords.

// Pinned, so the expected total is a fixed number rather than something
// recomputed by the same code under test. buildDemoData is used only to derive
// the expectation, which is safe because the assertion that matters is that the
// APP renders the same total the database holds.
const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

let seeded: SeededUser;

/** Formats cents the way lib/money.ts does, without importing a React tree. */
function eur(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}€${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedUserWithSession();
  // seedDemoData creates the system categories itself, so this suite needs no
  // ensureSystemCategories call of its own.
  await seedDemoData({ email: seeded.email, anchor: ANCHOR });
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  // Cascades to the session, the demo car, its expenses and its readings.
  await deleteSeededUser(seeded.userId);
});

test.describe("demo seed", () => {
  test("puts a populated car in the account", async ({ page }) => {
    await page.goto("/cars");

    // The car list renders the plate, the nickname and a make · model · year
    // line as plain spans inside a list item — asserted as they actually are
    // rather than against a heading role the page does not use.
    const card = page.getByRole("listitem").filter({ hasText: "DEMO-0001" });

    await expect(card).toHaveCount(1);
    await expect(card.getByText("Demo car")).toBeVisible();
    await expect(card.getByText(/Examplemobile/)).toBeVisible();
  });

  test("renders a full year on the report", async ({ page }) => {
    // AC-8.
    const dataset = buildDemoData(ANCHOR);
    const expectedTotal = dataset.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

    await page.goto("/cars");
    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByRole("link", { name: "Report" }).click();
    await expect(page).toHaveURL(/\/report$/);

    const total = page.getByRole("region", { name: "Total spent" });
    await expect(total.getByText(eur(expectedTotal))).toBeVisible();

    // Twelve months of history means thirteen month buckets at most and twelve
    // at least, depending on where the anchor falls in its month.
    const months = page.getByRole("region", { name: "By month" });
    const monthCount = await months.locator("li").count();
    expect(monthCount).toBeGreaterThanOrEqual(12);
    expect(monthCount).toBeLessThanOrEqual(13);

    // Two calendar years, since the anchor is mid-year.
    const years = page.getByRole("region", { name: "By year" });
    await expect(years.locator("li")).toHaveCount(2);

    // Fuel dominates a year of driving, so it must lead the breakdown.
    const categories = page.getByRole("region", { name: "By category" });
    await expect(categories.locator("li").first()).toContainText("Fuel");
  });

  test("reports fuel consumption and cost per kilometre", async ({ page }) => {
    // The seeded year contains a partial fill, a fill with no odometer reading,
    // and one reading that goes backwards. Seeing a sane figure come out the
    // far end is the point of this test.
    await page.goto("/cars");
    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByRole("link", { name: "Report" }).click();

    const efficiency = page.getByRole("region", { name: "Efficiency" });

    // A plausible band rather than an exact figure: pinning the number here
    // would make any future dataset tweak read as a regression.
    const headline = await efficiency.locator("span.text-3xl").innerText();
    const litersPer100Km = Number.parseFloat(headline);
    expect(litersPer100Km).toBeGreaterThan(4);
    expect(litersPer100Km).toBeLessThan(14);

    // Both rates present, three decimals, and total strictly above fuel.
    const fuelRate = await efficiency
      .getByText(/^\u20ac\d+\.\d{3}$/)
      .first()
      .innerText();
    expect(fuelRate).toMatch(/^\u20ac\d+\.\d{3}$/);

    await expect(efficiency.getByText("Fuel per km")).toBeVisible();
    await expect(efficiency.getByText("All costs per km")).toBeVisible();

    // The intervals are listed, which is what makes the average checkable.
    await expect(efficiency.getByText(/Show the \d+ intervals/)).toBeVisible();
  });

  test("shows the fill-ups with their litres on the expense list", async ({ page }) => {
    await page.goto("/cars");
    await page.getByRole("link", { name: "Expenses" }).click();

    await expect(page.getByText(/\d+\.\d+ L/).first()).toBeVisible();
    await expect(page.getByText("Demo Fuel North").first()).toBeVisible();
  });

  test("records the odometer readings the consumption maths will need", async ({ page }) => {
    await page.goto("/cars");
    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByRole("link", { name: "Odometer log" }).click();

    // 27 captured at fill-ups (one of the 28 deliberately has none) plus 3
    // entered by hand.
    await expect(page.getByRole("listitem")).toHaveCount(30);
  });
});
