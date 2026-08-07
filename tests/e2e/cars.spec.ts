import { expect, test } from "@playwright/test";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

// Runs on both the desktop and mobile projects (see playwright.config.ts), since
// mobile-first is a project convention rather than an afterthought.

let seeded: SeededUser;

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedUserWithSession();
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  // Cascades to the session and any cars created during the test.
  await deleteSeededUser(seeded.userId);
});

test.describe("cars", () => {
  // This runs first on purpose. If a hand-seeded session is not accepted, every
  // test below would fail for the same misleading reason, so prove the technique
  // works before proving anything about cars.
  test("a seeded database session authenticates the browser", async ({ page }) => {
    const response = await page.goto("/cars");

    expect(response?.status()).toBe(200);
    // Not redirected to sign-in is the actual assertion.
    expect(new URL(page.url()).pathname).toBe("/cars");
    await expect(page.getByRole("heading", { level: 1, name: "Your cars" })).toBeVisible();
  });

  test("shows an empty state before any car exists", async ({ page }) => {
    await page.goto("/cars");

    await expect(page.getByText(/no cars yet/i)).toBeVisible();
  });

  test("adds a car and lists it", async ({ page }) => {
    await page.goto("/cars");
    await page.getByRole("link", { name: "Add car" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Add a car" })).toBeVisible();

    await page.getByLabel("Licence plate").fill("test-0042");
    await page.getByLabel(/^Nickname/).fill("The runabout");
    await page.getByLabel(/^Make/).fill("Testla");
    await page.getByLabel("Fuel type").selectOption("DIESEL");
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page).toHaveURL(/\/cars$/);
    // Uppercased by the schema, so casing cannot create duplicate cars.
    await expect(page.getByText("TEST-0042")).toBeVisible();
    await expect(page.getByText("The runabout")).toBeVisible();
    await expect(page.getByText(/no cars yet/i)).toBeHidden();
  });

  test("rejects a blank licence plate without creating anything", async ({ page }) => {
    await page.goto("/cars/new");

    // Bypass the browser's own required-field UI to reach server validation.
    await page.getByLabel("Licence plate").fill(" ");
    await page.getByLabel("Licence plate").evaluate((el: HTMLInputElement) => {
      el.removeAttribute("required");
    });
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page.getByText(/licence plate is required/i)).toBeVisible();
    await expect(page).toHaveURL(/\/cars\/new$/);
  });

  test("edits a car's nickname", async ({ page }) => {
    await page.goto("/cars/new");
    await page.getByLabel("Licence plate").fill("TEST-0043");
    await page.getByLabel(/^Nickname/).fill("Before");
    await page.getByRole("button", { name: "Add car" }).click();
    await expect(page.getByText("Before")).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit car" })).toBeVisible();

    await page.getByLabel(/^Nickname/).fill("After");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(/\/cars$/);
    await expect(page.getByText("After")).toBeVisible();
    await expect(page.getByText("Before")).toBeHidden();
  });

  test("deletes a car, and says the expense history is kept", async ({ page }) => {
    await page.goto("/cars/new");
    await page.getByLabel("Licence plate").fill("TEST-0044");
    await page.getByRole("button", { name: "Add car" }).click();
    await expect(page.getByText("TEST-0044")).toBeVisible();

    // The confirmation must not claim permanent destruction — deletion is soft.
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("expense history will be kept");
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("TEST-0044")).toBeHidden();
    await expect(page.getByText(/no cars yet/i)).toBeVisible();
  });
});
