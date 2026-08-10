import { expect, test, type Page } from "@playwright/test";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";
import { ensureSystemCategories } from "./helpers/categories";

// Runs on both the desktop and mobile projects (see playwright.config.ts).
//
// Like the expenses suite, every figure is asserted as its euro string. A
// report is the one screen where a missed ÷100 would look entirely plausible,
// so "€57.32" is checked rather than the digits 5732 appearing somewhere.

let seeded: SeededUser;

async function addCarAndOpenExpenses(page: Page) {
  await page.goto("/cars");
  await page.getByRole("link", { name: "Add car" }).click();
  await page.getByLabel("Licence plate").fill("test-0099");
  await page.getByLabel(/^Nickname/).fill("The report car");
  await page.getByRole("button", { name: "Add car" }).click();
  await expect(page).toHaveURL(/\/cars$/);

  await page.getByRole("link", { name: "Expenses" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The report car" })).toBeVisible();
}

/** Adds an expense on an explicit date, so the month buckets are predictable. */
async function addExpense(
  page: Page,
  { amount, category, date }: { amount: string; category: string; date: string },
) {
  await page.getByRole("link", { name: "Add other" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add an expense" })).toBeVisible();

  await page.getByLabel("Amount (€)").fill(amount);
  await page.getByLabel("Category").selectOption({ label: category });
  await page.getByLabel("Date").fill(date);

  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
}

test.beforeEach(async ({ context, baseURL }) => {
  // System categories are global `userId: null` rows that no runtime code
  // creates. The integration suite truncates them and CI runs it immediately
  // before this suite, so seed rather than assume.
  await ensureSystemCategories();

  seeded = await seedUserWithSession();
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  await deleteSeededUser(seeded.userId);
});

test.describe("car report", () => {
  test("is reachable from the expense list and totals what was recorded", async ({ page }) => {
    await addCarAndOpenExpenses(page);

    // €45.20 + €12.05 + €0.07 = €57.32, across two months and two categories.
    await addExpense(page, { amount: "45.20", category: "Fuel", date: "2026-03-04" });
    await addExpense(page, { amount: "12.05", category: "Fuel", date: "2026-06-11" });
    await addExpense(page, { amount: "0.07", category: "Maintenance", date: "2026-06-12" });

    await page.getByRole("link", { name: "Report" }).click();
    await expect(page).toHaveURL(/\/report$/);
    await expect(page.getByRole("heading", { level: 1, name: "The report car" })).toBeVisible();

    // Each assertion is scoped to its own section. The same euro string can
    // legitimately appear in several — with everything in one year, the yearly
    // row equals the all-time total — so an unscoped getByText would be
    // ambiguous rather than wrong.
    const total = page.getByRole("region", { name: "Total spent" });
    const years = page.getByRole("region", { name: "By year" });
    const months = page.getByRole("region", { name: "By month" });
    const categories = page.getByRole("region", { name: "By category" });

    await expect(total.getByText("€57.32")).toBeVisible();

    // By year: one year, carrying the whole total.
    await expect(years.getByText("2026", { exact: true })).toBeVisible();
    await expect(years.getByText("€57.32")).toBeVisible();

    // By month: June before March, and April/May absent rather than €0.00.
    await expect(months.getByText("Jun 2026")).toBeVisible();
    await expect(months.getByText("€12.12")).toBeVisible(); // 12.05 + 0.07
    await expect(months.getByText("Mar 2026")).toBeVisible();
    await expect(months.getByText("€45.20")).toBeVisible();
    await expect(months.getByText("Apr 2026")).toHaveCount(0);
    await expect(months.getByText("May 2026")).toHaveCount(0);
    await expect(months.locator("li")).toHaveText([/Jun 2026/, /Mar 2026/]);

    // By category, biggest first: Fuel 45.20 + 12.05, Maintenance 0.07.
    await expect(categories.getByText("€57.25")).toBeVisible();
    await expect(categories.getByText("€0.07")).toBeVisible();
    await expect(categories.locator("li")).toHaveText([/Fuel/, /Maintenance/]);
  });

  test("shows a zero total and empty states for a car with nothing recorded", async ({ page }) => {
    await addCarAndOpenExpenses(page);

    await page.getByRole("link", { name: "Report" }).click();

    await expect(page.getByText("€0.00")).toBeVisible();
    await expect(page.getByText(/nothing to total/i)).toBeVisible();
    await expect(page.getByText(/Months appear here/i)).toBeVisible();
    await expect(page.getByText(/Categories appear here/i)).toBeVisible();
  });

  test("explains what is missing instead of claiming 0.0 L/100km", async ({ page }) => {
    // AC-7. A car with no fill-ups has UNKNOWN consumption, which is a
    // different statement from zero — and only one of them is true.
    await addCarAndOpenExpenses(page);
    await page.getByRole("link", { name: "Report" }).click();

    const efficiency = page.getByRole("region", { name: "Efficiency" });

    await expect(efficiency.getByText(/two or more full tank-ups/i)).toBeVisible();
    await expect(efficiency.getByText(/cost per kilometre/i)).toBeVisible();
    await expect(efficiency.getByText("0.0 L/100km")).toHaveCount(0);
    await expect(efficiency.getByText(/\u20ac0\.000/)).toHaveCount(0);
  });

  test("links back to the expense list", async ({ page }) => {
    await addCarAndOpenExpenses(page);
    await page.getByRole("link", { name: "Report" }).click();
    await expect(page).toHaveURL(/\/report$/);

    await page.getByRole("link", { name: "← Expenses" }).click();

    await expect(page).toHaveURL(/\/expenses$/);
    await expect(page.getByRole("link", { name: "Add fuel" })).toBeVisible();
  });

  test("has no report for a car id that is not the user's", async ({ page }) => {
    // The scoped read makes a stranger's car indistinguishable from one that
    // never existed. Asserted through the browser as well as in the integration
    // suite, because this is the response a real attacker would see.
    const response = await page.goto("/cars/not-a-real-car-id/report");

    expect(response?.status()).toBe(404);
  });
});
