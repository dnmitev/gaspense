import { expect, test } from "@playwright/test";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";
import { ensureSystemCategories } from "./helpers/categories";

let seeded: SeededUser;

test.beforeEach(async ({ context, baseURL }) => {
  await ensureSystemCategories();
  seeded = await seedUserWithSession();
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  await deleteSeededUser(seeded.userId);
});

/**
 * Creates a car, opens its odometer log, and returns the expenses URL.
 *
 * Returns the URL rather than relying on `page.goBack()`: back-navigation makes
 * the test depend on history depth, which changes as soon as a step is added.
 */
async function addCarAndOpenOdometer(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/cars/new");
  await page.getByLabel("Licence plate").fill("test-0088");
  await page.getByLabel(/^Nickname/).fill("The test car");
  await page.getByRole("button", { name: "Add car" }).click();
  await expect(page).toHaveURL(/\/cars$/);

  await page.getByRole("link", { name: "Expenses" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The test car" })).toBeVisible();
  const expensesUrl = page.url();

  await page.getByRole("link", { name: "Odometer log" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Odometer" })).toBeVisible();

  return expensesUrl;
}

/** Records a fill-up with an odometer reading, from the car's expense list. */
async function addFuelWithOdometer(
  page: import("@playwright/test").Page,
  expensesUrl: string,
  km: string,
) {
  await page.goto(expensesUrl);
  await page.getByRole("link", { name: "Add fuel" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add fuel" })).toBeVisible();

  await page.getByLabel("Amount (€)").fill("60.00");
  await page.getByLabel("Odometer (km)").fill(km);
  await page.getByRole("button", { name: "Add fuel" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
}

test.describe("odometer", () => {
  test("adds, edits, and deletes a reading", async ({ page }) => {
    await addCarAndOpenOdometer(page);
    await expect(page.getByText(/no readings yet/i)).toBeVisible();

    await page.getByRole("link", { name: "Add reading" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add a reading" })).toBeVisible();
    await page.getByLabel("Odometer (km)").fill("120000");
    await page.getByRole("button", { name: "Add reading" }).click();

    await expect(page.getByText("120,000 km").first()).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit reading" })).toBeVisible();
    await page.getByLabel("Odometer (km)").fill("130000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("130,000 km").first()).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByText(/no readings yet/i)).toBeVisible();
  });

  test("rejects a fractional reading", async ({ page }) => {
    await addCarAndOpenOdometer(page);
    await page.getByRole("link", { name: "Add reading" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add a reading" })).toBeVisible();

    await page.getByLabel("Odometer (km)").fill("120000.5");
    await page.getByRole("button", { name: "Add reading" }).click();

    await expect(page.getByText("Reading must be a whole number of kilometres")).toBeVisible();
  });

  test("a fill-up's odometer appears in the log, labelled and linked", async ({ page }) => {
    // AC-7 end to end: the reading is captured on the expense form, not here.
    const expensesUrl = await addCarAndOpenOdometer(page);

    await addFuelWithOdometer(page, expensesUrl, "150000");

    await page.getByRole("link", { name: "Odometer log" }).click();
    await expect(page.getByText("150,000 km").first()).toBeVisible();
    await expect(page.getByText(/recorded with a fill-up/i)).toBeVisible();
  });

  test("clearing the odometer on the expense removes its reading", async ({ page }) => {
    // AC-8 from the outside: the reading exists only as part of the expense.
    const expensesUrl = await addCarAndOpenOdometer(page);
    await addFuelWithOdometer(page, expensesUrl, "150000");

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit expense" })).toBeVisible();
    await page.getByLabel("Odometer (km)").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();

    await page.getByRole("link", { name: "Odometer log" }).click();
    await expect(page.getByText(/no readings yet/i)).toBeVisible();
  });

  test("deleting the fill-up removes its reading too", async ({ page }) => {
    const expensesUrl = await addCarAndOpenOdometer(page);
    await addFuelWithOdometer(page, expensesUrl, "150000");

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();

    await page.getByRole("link", { name: "Odometer log" }).click();
    await expect(page.getByText(/no readings yet/i)).toBeVisible();
  });
});
