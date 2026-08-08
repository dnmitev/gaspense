import { expect, test } from "@playwright/test";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";
import { ensureSystemCategories } from "./helpers/categories";

// Runs on both the desktop and mobile projects (see playwright.config.ts).
//
// The money assertions here are the point of the suite: every amount is checked
// as its euro string, so a missed ÷100 fails the test rather than shipping a
// plausible-looking number.

let seeded: SeededUser;

/** Creates a car through the UI and returns to its (empty) expense list. */
async function addCarAndOpenExpenses(page: import("@playwright/test").Page) {
  await page.goto("/cars");
  await page.getByRole("link", { name: "Add car" }).click();
  await page.getByLabel("Licence plate").fill("test-0077");
  await page.getByLabel(/^Nickname/).fill("The test car");
  await page.getByRole("button", { name: "Add car" }).click();
  await expect(page).toHaveURL(/\/cars$/);

  await page.getByRole("link", { name: "Expenses" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The test car" })).toBeVisible();
}

/**
 * Adds an expense through the "Add other" entry point.
 *
 * Fuel entry is exercised separately, since the two differ in which fields the
 * form presents and in whether a category comes preselected.
 */
async function addExpense(
  page: import("@playwright/test").Page,
  { amount, category = "Fuel", notes }: { amount: string; category?: string; notes?: string },
) {
  await page.getByRole("link", { name: "Add other" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add an expense" })).toBeVisible();

  await page.getByLabel("Amount (€)").fill(amount);
  await page.getByLabel("Category").selectOption({ label: category });
  if (notes) await page.getByLabel(/^Notes/).fill(notes);

  await page.getByRole("button", { name: "Add expense" }).click();
}

test.beforeEach(async ({ context, baseURL }) => {
  // The category select is populated from global `userId: null` rows created by
  // the seed script, not by the app. The integration suite truncates them and CI
  // runs it immediately before this suite, so seed them rather than assume.
  await ensureSystemCategories();

  seeded = await seedUserWithSession();
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  // Cascades to the session, cars, and their expenses.
  await deleteSeededUser(seeded.userId);
});

test.describe("expenses", () => {
  test("shows an empty state and a zero total before anything is recorded", async ({ page }) => {
    await addCarAndOpenExpenses(page);

    await expect(page.getByText(/no expenses yet/i)).toBeVisible();
    await expect(page.getByText("€0.00")).toBeVisible();
  });

  test("records an expense in euros and lists it back in euros", async ({ page }) => {
    // AC-2 and AC-7. "45.20" in, "€45.20" out — if the stored value were 45 or
    // 452000 cents, this assertion is what catches it.
    await addCarAndOpenExpenses(page);

    await addExpense(page, { amount: "45.20", notes: "First fill" });

    await expect(page).toHaveURL(/\/expenses$/);
    await expect(page.getByText("First fill")).toBeVisible();
    await expect(page.getByText("€45.20").first()).toBeVisible();
    await expect(page.getByText(/no expenses yet/i)).toBeHidden();
  });

  test("accepts a comma decimal separator", async ({ page }) => {
    // What a European keyboard produces; parseFloat would silently read €12.00.
    await addCarAndOpenExpenses(page);

    await addExpense(page, { amount: "12,34", notes: "Comma entry" });

    await expect(page.getByText("€12.34").first()).toBeVisible();
  });

  test("rejects a malformed amount with a readable message", async ({ page }) => {
    // AC-3 through the real form, not just the schema.
    await addCarAndOpenExpenses(page);

    await addExpense(page, { amount: "12.345" });

    await expect(page.getByText("Enter an amount like 45.20")).toBeVisible();
    // Still on the form, nothing created.
    await expect(page.getByRole("heading", { level: 1, name: "Add an expense" })).toBeVisible();
  });

  test("sums multiple expenses into a total", async ({ page }) => {
    await addCarAndOpenExpenses(page);

    await addExpense(page, { amount: "45.20", notes: "One" });
    await addExpense(page, { amount: "4.80", notes: "Two" });

    // Summed as integers, formatted once — 4520 + 480 = 5000 cents.
    await expect(page.getByText("€50.00")).toBeVisible();
  });

  test("edits an expense, seeding the form with euros rather than cents", async ({ page }) => {
    await addCarAndOpenExpenses(page);
    await addExpense(page, { amount: "45.20", notes: "Before edit" });

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit expense" })).toBeVisible();

    // The seeded value must be "45.20". If it were the raw 4520, saving
    // unchanged would silently turn €45.20 into €4520.00.
    await expect(page.getByLabel("Amount (€)")).toHaveValue("45.20");

    await page.getByLabel("Amount (€)").fill("7");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(/\/expenses$/);
    await expect(page.getByText("€7.00").first()).toBeVisible();
    await expect(page.getByText("€45.20")).toBeHidden();
  });

  test("deletes an expense", async ({ page }) => {
    await addCarAndOpenExpenses(page);
    await addExpense(page, { amount: "45.20", notes: "To be deleted" });

    // The button confirms first; auto-accept the dialog.
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();

    await expect(page.getByText("To be deleted")).toBeHidden();
    await expect(page.getByText(/no expenses yet/i)).toBeVisible();
  });

  test("fuel entry shows the fuel fields and preselects the Fuel category", async ({ page }) => {
    // AC-9. The fuel form is a distinct entry point, not the same form with a
    // different label.
    await addCarAndOpenExpenses(page);

    await page.getByRole("link", { name: "Add fuel" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add fuel" })).toBeVisible();

    // Preselected from the seeded SYSTEM category, so the common case is one
    // fewer decision.
    await expect(page.getByLabel("Category")).toHaveValue(/.+/);
    // Fuel fields are present outright, not behind a disclosure.
    await expect(page.getByLabel("Litres")).toBeVisible();

    await page.getByLabel("Amount (€)").fill("60.00");
    await page.getByLabel("Litres").fill("42.5");
    await page.getByLabel("Station").fill("Test Station");
    await page.getByRole("button", { name: "Add fuel" }).click();

    await expect(page).toHaveURL(/\/expenses$/);
    await expect(page.getByText("€60.00").first()).toBeVisible();
    await expect(page.getByText(/42\.5 L/)).toBeVisible();
  });

  test("other entry keeps the fuel fields collapsed but reachable", async ({ page }) => {
    // AC-9's second half: hidden by default, never removed — an expense that
    // turns out to have litres must still be editable.
    await addCarAndOpenExpenses(page);

    await page.getByRole("link", { name: "Add other" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add an expense" })).toBeVisible();

    await expect(page.getByLabel("Litres")).toBeHidden();

    await page.getByText("Add fuel details").click();
    await expect(page.getByLabel("Litres")).toBeVisible();
  });

  test("a soft-deleted car makes its expenses unreachable", async ({ page }) => {
    // AC-6, from the outside: the route 404s once the car is gone.
    await addCarAndOpenExpenses(page);
    await addExpense(page, { amount: "45.20" });

    const expensesUrl = page.url();

    await page.goto("/cars");
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByText(/no cars yet/i)).toBeVisible();

    const response = await page.goto(expensesUrl);
    expect(response?.status()).toBe(404);
  });
});
