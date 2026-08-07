import { expect, test } from "@playwright/test";

// Scoped to what actually exists: there is no navigation, auth, or data yet.
// This suite runs against the production build on both a desktop and a mobile
// viewport (see playwright.config.ts projects).
test.describe("home page", () => {
  test("serves the app shell with the correct title and heading", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Gaspense");
    await expect(page.getByRole("heading", { level: 1, name: "Gaspense" })).toBeVisible();
  });

  test("renders the placeholder copy", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/application shell is in place/i)).toBeVisible();
  });
});
