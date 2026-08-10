import { expect, test } from "@playwright/test";
import { seedDemoData } from "../../lib/seed-demo";
import { ensureSystemCategories } from "./helpers/categories";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

/**
 * "Adding an expense takes seconds" — the half of Phase 4's goal this plan owns.
 *
 * Before this plan, logging a fill-up cost three taps before the form appeared:
 * dashboard, "Your cars", "Expenses", "Add fuel". The tap count is therefore an
 * assertion here, not a claim in a summary.
 */

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

let seeded: SeededUser;

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedUserWithSession();
  await ensureSystemCategories();
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  await deleteSeededUser(seeded.userId);
});

test.describe("quick add — from the dashboard", () => {
  test.beforeEach(async () => {
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });
  });

  test("one tap from the dashboard reaches the fuel form for that car", async ({ page }) => {
    // AC-1. Exactly one click between the dashboard and a usable fuel form —
    // no intermediate page, which is the whole point.
    await page.goto("/");

    await page.getByRole("link", { name: "Add fuel for DEMO-0001" }).click();

    await expect(page).toHaveURL(/\/cars\/[^/]+\/expenses\/new\?type=fuel$/);
    await expect(page.getByRole("heading", { level: 1, name: "Add fuel" })).toBeVisible();

    // The fuel fields are already visible, not behind the disclosure.
    await expect(page.getByLabel("Litres")).toBeVisible();
    await expect(page.getByLabel("Odometer (km)")).toBeVisible();
    await expect(page.getByLabel("Full tank")).toBeVisible();
  });

  test("the card also offers a non-fuel expense and the history", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Add an expense for DEMO-0001" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add an expense" })).toBeVisible();
    // Fuel fields stay collapsed on the non-fuel path — 02-06's rule, unchanged.
    await expect(page.getByLabel("Litres")).toBeHidden();

    await page.goto("/");
    await page.getByRole("link", { name: "All expenses for DEMO-0001" }).click();
    await expect(page).toHaveURL(/\/cars\/[^/]+\/expenses$/);
  });
});

test.describe("quick add — the car-agnostic route", () => {
  test("shows no car picker when there is only one car", async ({ page }) => {
    // AC-2. A one-option combobox is a question with a single answer.
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });

    await page.goto("/expenses/new?type=fuel");

    await expect(page.getByLabel("Amount (€)")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Car" })).toHaveCount(0);
  });

  test("asks which car when there are several, defaulting to the newest", async ({ page }) => {
    // AC-2. The second car is created after the demo one, and listActiveCars
    // orders createdAt: "desc", so the newest is preselected.
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });

    await page.goto("/cars/new");
    await page.getByLabel("Licence plate").fill("QUICK-0002");
    await page.getByRole("button", { name: /Add car|Save/ }).click();
    await expect(page).toHaveURL(/\/cars$/);

    await page.goto("/expenses/new?type=fuel");

    const picker = page.getByRole("combobox", { name: "Car" });
    await expect(picker).toBeVisible();
    await expect(picker.locator("option")).toHaveCount(2);
    // The newest car is selected, not the demo one.
    await expect(picker).toHaveValue(/.+/);
    const selectedLabel = await picker.locator("option:checked").textContent();
    expect(selectedLabel).toContain("QUICK-0002");
  });

  test("is advertised as an installed-app shortcut", async ({ request }) => {
    // Without this the route has no consumer: nothing in the UI links to it,
    // because with cars on screen the per-card actions are strictly better. The
    // manifest shortcut is what makes a car-agnostic route worth having.
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const urls = (manifest.shortcuts ?? []).map((shortcut: { url: string }) => shortcut.url);

    expect(urls).toContain("/expenses/new?type=fuel");
    expect(urls).toContain("/expenses/new");
  });

  test("sends a user with no cars to the car form instead", async ({ page }) => {
    // AC-2. No demo data seeded in this test: the account has no cars at all.
    await page.goto("/expenses/new");

    await expect(page).toHaveURL(/\/cars\/new$/);
  });

  test("records a fill-up with its litres and odometer reading", async ({ page }) => {
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });

    await page.goto("/expenses/new?type=fuel");

    await page.getByLabel("Amount (€)").fill("61.40");
    await page.getByLabel("Litres").fill("41.2");
    await page.getByLabel("Odometer (km)").fill("999000");
    await page.getByLabel("Full tank").check();
    await page.getByRole("button", { name: "Add fuel" }).click();

    // Lands on the car's expense list, where the new row is visible.
    await expect(page).toHaveURL(/\/cars\/[^/]+\/expenses$/);
    await expect(page.getByText("€61.40")).toBeVisible();

    // And the reading reached the odometer log, linked to that expense.
    // Scoped to the list: the page also shows the same figure as the "latest
    // reading" headline, and an unscoped locator matches both.
    await page.getByRole("link", { name: /Odometer/i }).click();
    await expect(page.getByRole("list").getByText("999,000 km")).toBeVisible();
  });
});

test.describe("quick add — keyboard only", () => {
  test.beforeEach(async () => {
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });
  });

  test("focuses the amount field on arrival so typing starts immediately", async ({ page }) => {
    // AC-5. On a phone this is most of what "takes seconds" means: the keypad is
    // already up.
    await page.goto("/expenses/new?type=fuel");

    await expect(page.getByLabel("Amount (€)")).toBeFocused();
  });

  test("reaches every control in visual order by Tab, each with a name", async ({ page }) => {
    // AC-5. Accessible NAMES, not ids — this is the assertion that catches a
    // lost label association, which the axe audit does not: the amount input has
    // a placeholder, and a placeholder alone satisfies axe's WCAG-tagged rules.
    //
    // ⚠️ Collected as a SEQUENCE rather than one Tab per field. Chromium's
    // `<input type="date">` has internal day/month/year stops, so a single Tab
    // moves *within* the date control and the naive one-Tab-per-field version of
    // this test failed on a real browser behaviour rather than a bug. Consecutive
    // duplicates are collapsed and the expected order is asserted as a
    // subsequence, which is what "visual order" actually means here.
    await page.goto("/expenses/new?type=fuel");

    const focusedName = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return null;
        const id = active.getAttribute("id");
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        return (
          label?.textContent?.trim() ??
          active.getAttribute("aria-label") ??
          active.textContent?.trim() ??
          null
        );
      });

    const order: string[] = [];
    const record = async () => {
      const name = await focusedName();
      if (name && order.at(-1) !== name) order.push(name);
    };

    // Amount holds focus on load; walk forward from there.
    await record();
    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press("Tab");
      await record();
    }

    const indexOfName = (needle: string) => order.findIndex((name) => name.includes(needle));

    for (const field of ["Amount", "Category", "Date", "Notes", "Litres", "Full tank"]) {
      expect(indexOfName(field), `${field} should be reachable by Tab`).toBeGreaterThan(-1);
    }

    // Visual order, field by field.
    expect(indexOfName("Amount")).toBeLessThan(indexOfName("Category"));
    expect(indexOfName("Category")).toBeLessThan(indexOfName("Date"));
    expect(indexOfName("Date")).toBeLessThan(indexOfName("Notes"));
    expect(indexOfName("Notes")).toBeLessThan(indexOfName("Litres"));
    expect(indexOfName("Litres")).toBeLessThan(indexOfName("Full tank"));

    // And the submit control is reachable without a mouse at all.
    expect(indexOfName("Add fuel")).toBeGreaterThan(indexOfName("Full tank"));
  });

  test("submits with the keyboard alone", async ({ page }) => {
    await page.goto("/expenses/new?type=fuel");

    await page.keyboard.type("12.34");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/cars\/[^/]+\/expenses$/);
    await expect(page.getByText("€12.34")).toBeVisible();
  });
});
