import { expect, test } from "@playwright/test";
import { STUB_PLATES } from "../../lib/vignette-stub";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

/**
 * The vignette check, end to end.
 *
 * ⚠️ **Runs entirely against the stub.** `playwright.config.ts` forces
 * `VIGNETTE_DRIVER=stub` in both the workers and the server under test, so
 * nothing here reaches `check.bgtoll.bg` — a public government endpoint that a
 * CI run has no business calling. The plates below are the stub's own.
 */

let seeded: SeededUser;

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedUserWithSession();
  await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
});

test.afterEach(async () => {
  await deleteSeededUser(seeded.userId);
});

async function addCar(page: import("@playwright/test").Page, plate: string) {
  await page.goto("/cars/new");
  await page.getByLabel("Licence plate").fill(plate);
  await page.getByRole("button", { name: /Add car|Save/ }).click();
  await expect(page).toHaveURL(/\/cars$/);
}

const checkButton = (page: import("@playwright/test").Page, plate: string) =>
  page.getByRole("button", { name: `Check the Bulgarian vignette for ${plate}` });

test.describe("vignette status", () => {
  test("a new car reports that it has not been checked", async ({ page }) => {
    await addCar(page, STUB_PLATES.active);

    await expect(page.getByText("Bulgarian vignette: not checked yet")).toBeVisible();
    await expect(checkButton(page, STUB_PLATES.active)).toBeVisible();
  });

  test("checking an active vignette shows its expiry", async ({ page }) => {
    // AC-1.
    await addCar(page, STUB_PLATES.active);

    await checkButton(page, STUB_PLATES.active).click();

    await expect(page.getByText(/Bulgarian vignette: valid until 2026-12-15/)).toBeVisible();
    await expect(page.getByText(/Checked \d{4}-\d{2}-\d{2}/)).toBeVisible();
  });

  test("a plate with no vignette says so plainly", async ({ page }) => {
    await addCar(page, STUB_PLATES.none);

    await checkButton(page, STUB_PLATES.none).click();

    await expect(page.getByText("Bulgarian vignette: none active")).toBeVisible();
  });

  test("⚠️ an unreachable service does NOT read as 'no vignette'", async ({ page }) => {
    // The most damaging thing this feature could get wrong: reporting a vignette
    // as gone because a government endpoint was down.
    await addCar(page, STUB_PLATES.unavailable);

    await checkButton(page, STUB_PLATES.unavailable).click();

    await expect(page.getByText("Last check could not reach the service")).toBeVisible();
    await expect(page.getByText("Bulgarian vignette: none active")).toHaveCount(0);
  });
});

test.describe("the cooldown", () => {
  test("replaces the button after a check, rather than refusing a press", async ({ page }) => {
    // AC-3. The page decides server-side whether to offer the action at all, so
    // there is nothing to press and nothing to refuse.
    await addCar(page, STUB_PLATES.active);

    await checkButton(page, STUB_PLATES.active).click();

    await expect(checkButton(page, STUB_PLATES.active)).toHaveCount(0);
    await expect(page.getByText(/Can check again in about \d+ min/)).toBeVisible();
  });
});

test.describe("isolation", () => {
  test("a forged carId writes nothing and shows nothing", async ({ page, browser, baseURL }) => {
    // AC-4, through the real form. A second account's car id is posted from the
    // first account's session.
    const other = await seedUserWithSession();
    const otherContext = await browser.newContext();
    let otherCarId = "";
    try {
      await applySessionCookie(
        otherContext,
        other.sessionToken,
        baseURL ?? "http://localhost:3000",
      );
      const otherPage = await otherContext.newPage();
      await addCar(otherPage, STUB_PLATES.active);
      const href = await otherPage
        .getByRole("link", { name: "Expenses" })
        .first()
        .getAttribute("href");
      otherCarId = href!.split("/")[2];
      await otherPage.close();
    } finally {
      await otherContext.close();
    }

    // Now, as the first user, post that car id at the action.
    await addCar(page, "MINE-0001");
    await page.evaluate(async (carId) => {
      const form = document.querySelector("form") as HTMLFormElement;
      const hidden = form.querySelector('input[name="carId"]') as HTMLInputElement;
      if (hidden) hidden.value = carId;
    }, otherCarId);

    await page
      .getByRole("button", { name: /Check the Bulgarian vignette/ })
      .first()
      .click();
    await page.waitForLoadState("networkidle");

    // The victim's car still reports as never checked, from their own session.
    const victimContext = await browser.newContext();
    try {
      await applySessionCookie(
        victimContext,
        other.sessionToken,
        baseURL ?? "http://localhost:3000",
      );
      const victimPage = await victimContext.newPage();
      await victimPage.goto("/cars");
      await expect(victimPage.getByText("Bulgarian vignette: not checked yet")).toBeVisible();
    } finally {
      await victimContext.close();
      await deleteSeededUser(other.userId);
    }
  });
});
