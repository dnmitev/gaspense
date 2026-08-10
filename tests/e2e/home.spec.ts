import { expect, test } from "@playwright/test";
import { seedDemoData } from "../../lib/seed-demo";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

// Rewritten in 03-03. This suite previously asserted placeholder copy on an
// unauthenticated `/` — flagged as expected-to-break since Phase 2, because the
// placeholder was always going to become the dashboard.
//
// Runs on both the desktop and mobile projects (see playwright.config.ts).

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

let seeded: SeededUser;

test.beforeEach(async () => {
  seeded = await seedUserWithSession();
});

test.afterEach(async () => {
  await deleteSeededUser(seeded.userId);
});

test.describe("dashboard — signed out", () => {
  test("redirects to sign-in and shows no data", async ({ page }) => {
    // AC-7. No session cookie is applied in this block.
    await page.goto("/");

    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByText(/DEMO-0001/)).toHaveCount(0);
    await expect(page.getByText(/Total across/)).toHaveCount(0);
  });
});

test.describe("dashboard — no cars yet", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
  });

  test("invites the user to add a car instead of showing an empty total", async ({ page }) => {
    // AC-8. No €0.00 headline: it would state as fact something the user has
    // simply not recorded yet.
    await page.goto("/");

    const start = page.getByRole("region", { name: "Get started" });
    await expect(start.getByText(/Nothing tracked yet/i)).toBeVisible();

    await expect(page.getByRole("region", { name: "Total spent" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Monthly spend" })).toHaveCount(0);
    await expect(page.getByText("€0.00")).toHaveCount(0);
  });

  test("links to the car form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Add your first car" }).click();

    await expect(page).toHaveURL(/\/cars\/new$/);
  });
});

test.describe("dashboard — with a populated account", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });
    await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
  });

  test("serves the app shell with the correct title and heading", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Gaspense");
    await expect(page.getByRole("heading", { level: 1, name: "Gaspense" })).toBeVisible();
  });

  test("shows the fleet total and a card per car", async ({ page }) => {
    // AC-1.
    await page.goto("/");

    const total = page.getByRole("region", { name: "Total spent" });
    await expect(total.getByText(/Total across 1 car/)).toBeVisible();
    await expect(total.getByText(/^€[\d,.]+$/)).toBeVisible();

    const cars = page.getByRole("region", { name: "Your cars" });
    await expect(cars.getByText("DEMO-0001")).toBeVisible();
    await expect(cars.getByText("Demo car")).toBeVisible();
  });

  test("renders the chart as SVG in the markup, without JavaScript", async ({ page }) => {
    // AC-2. Asserted against the served HTML rather than the rendered DOM, so a
    // client-side-only chart would fail this even if it looked right.
    const response = await page.goto("/");
    const html = (await response?.text()) ?? "";

    expect(html).toContain("<svg");
    expect(html).toMatch(/<rect[^>]*height="\d+"/);
    // NaN heights render as a dropped attribute and an invisible chart.
    expect(html).not.toContain('height="NaN"');

    const chart = page.getByRole("region", { name: "Monthly spend" });
    await expect(chart.getByRole("img")).toBeVisible();
  });

  test("names the chart for a screen reader", async ({ page }) => {
    // A bare <svg> of rectangles announces nothing at all.
    await page.goto("/");

    const chart = page.getByRole("region", { name: "Monthly spend" }).getByRole("img");

    await expect(chart).toHaveAttribute("aria-label", /Spending across \d+ months/);
    await expect(chart).toHaveAttribute("aria-label", /Highest was/);
  });

  test("shows each car's consumption alongside its total", async ({ page }) => {
    // AC-4. The demo car has enough fill-ups to be measurable.
    await page.goto("/");

    const cars = page.getByRole("region", { name: "Your cars" });

    await expect(cars.getByText(/\d+\.\d L\/100km/)).toBeVisible();
    await expect(cars.getByText("0.0 L/100km")).toHaveCount(0);
  });

  test("links each car card to that car's report", async ({ page }) => {
    // AC-9.
    //
    // Locator narrowed in 04-02, and expected: the card now carries "Add fuel",
    // "Add an expense" and "All expenses" links alongside the report one, so
    // `getByRole("link").first()` is no longer unambiguous. Naming the report
    // link is what the test always meant.
    await page.goto("/");
    await page
      .getByRole("region", { name: "Your cars" })
      .getByRole("link", { name: "Report for DEMO-0001" })
      .click();

    await expect(page).toHaveURL(/\/cars\/[^/]+\/report$/);
    await expect(page.getByRole("heading", { level: 1, name: "Demo car" })).toBeVisible();
  });
});
