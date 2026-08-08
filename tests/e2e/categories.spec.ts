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

async function addCategory(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Category name").fill(name);
  await page.getByRole("button", { name: "Add category" }).click();
}

test.describe("categories", () => {
  test("adds, renames, and deletes a category", async ({ page }) => {
    await page.goto("/categories");
    await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();

    const own = page.getByRole("list", { name: "Your categories" });

    await addCategory(page, "Servicing");
    await expect(own.getByText("Servicing")).toBeVisible();

    await page.getByRole("link", { name: "Rename" }).click();
    // Wait for the edit page before touching its field: /categories also has a
    // "Category name" input (the add form), so filling too early lands there.
    await expect(page.getByRole("heading", { level: 1, name: "Rename category" })).toBeVisible();
    // Not "Maintenance": that is a seeded default, so the assertion would match
    // the built-in chip as well as this row.
    await page.getByLabel("Category name").fill("Garage visits");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(own.getByText("Garage visits")).toBeVisible();
    await expect(own.getByText("Servicing")).toBeHidden();

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(/have not added any categories/i)).toBeVisible();
  });

  test("rejects a duplicate name with a field error rather than crashing", async ({ page }) => {
    // The constraint is a raw-SQL partial index, so this arrives as a Prisma
    // P2002 with nothing in the type system to catch it.
    await page.goto("/categories");
    await addCategory(page, "Servicing");
    await addCategory(page, "Servicing");

    await expect(page.getByText("You already have a category with that name")).toBeVisible();
    // Still a working page, not an error screen.
    await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();
  });

  test("shows the built-in categories as read-only", async ({ page }) => {
    await page.goto("/categories");

    await expect(page.getByText(/shared across all accounts/i)).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Built-in categories" }).getByText("Fuel"),
    ).toBeVisible();
    // Nothing to rename until the user adds their own.
    await expect(page.getByRole("link", { name: "Rename" })).toHaveCount(0);
  });

  test("refuses to delete a category that expenses use, and says how many", async ({ page }) => {
    await page.goto("/categories");
    await addCategory(page, "Servicing");

    // A car and an expense filed under the new category.
    await page.goto("/cars/new");
    await page.getByLabel("Licence plate").fill("test-0055");
    await page.getByRole("button", { name: "Add car" }).click();
    await expect(page).toHaveURL(/\/cars$/);
    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByRole("link", { name: "Add other" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add an expense" })).toBeVisible();
    await page.getByLabel("Amount (€)").fill("10.00");
    await page.getByLabel("Category").selectOption({ label: "Servicing" });
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.goto("/categories");
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(/used by 1 expense/i)).toBeVisible();
    // Nothing was destroyed or quietly reassigned.
    await expect(
      page.getByRole("list", { name: "Your categories" }).getByText("Servicing"),
    ).toBeVisible();
  });
});
