import { expect, test } from "@playwright/test";
import { seedDemoData } from "../../lib/seed-demo";
import {
  applySessionCookie,
  deleteSeededUser,
  seedUserWithSession,
  type SeededUser,
} from "./helpers/auth";

/**
 * Installability, and the service worker's cache boundary.
 *
 * A new file rather than additions to home.spec.ts, which 03-03 owns.
 *
 * The load-bearing test in here is "an offline navigation does not serve the
 * user's data". Everything else confirms the app can be installed; that one
 * confirms the worker cannot leak a signed-in page out of a cache the server
 * can neither reach nor clear.
 *
 * Runs on both the desktop and mobile projects (see playwright.config.ts).
 */

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

/** Resolves once the worker is not merely registered but actually controlling the page. */
async function waitForServiceWorkerControl(page: import("@playwright/test").Page) {
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return !!registration.active && !!navigator.serviceWorker.controller;
  });
}

test.describe("installability — no session required", () => {
  test("serves a complete manifest to a signed-out browser", async ({ request }) => {
    // AC-1. A manifest the browser cannot fetch before sign-in means the app is
    // never installable, so this deliberately runs with no session cookie.
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();

    expect(manifest.name).toBe("Gaspense");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(
      true,
    );
  });

  test("serves every declared icon as a real PNG", async ({ request }) => {
    // AC-2, over HTTP rather than off disk: this catches a file that exists but
    // is not actually reachable at the path the manifest names.
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const paths = [
      ...manifest.icons.map((icon: { src: string }) => icon.src),
      "/apple-touch-icon.png",
    ];

    for (const path of paths) {
      const response = await request.get(path);
      expect(response.status(), `${path} should be served`).toBe(200);
      expect(response.headers()["content-type"], `${path} content type`).toContain("image/png");
    }
  });

  test("links the manifest and the apple touch icon from the document head", async ({ page }) => {
    await page.goto("/signin");

    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});

test.describe("service worker", () => {
  let seeded: SeededUser;

  test.beforeEach(async ({ context, baseURL }) => {
    seeded = await seedUserWithSession();
    await seedDemoData({ email: seeded.email, anchor: ANCHOR });
    await applySessionCookie(context, seeded.sessionToken, baseURL ?? "http://localhost:3000");
  });

  test.afterEach(async () => {
    await deleteSeededUser(seeded.userId);
  });

  test("registers and takes control of the page", async ({ page }) => {
    // AC-3.
    await page.goto("/");
    await waitForServiceWorkerControl(page);

    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.state ?? null;
    });

    expect(active).toBe("activated");
  });

  test("never puts an HTML document in the cache", async ({ page }) => {
    // AC-4, stated directly against Cache Storage rather than inferred from
    // behaviour. This names the failure precisely if it ever regresses.
    await page.goto("/");
    await waitForServiceWorkerControl(page);
    // A second, now-controlled visit: this is the request a caching worker would
    // actually store. The first one happens before the worker controls the page.
    await page.goto("/");
    await expect(page.getByText("DEMO-0001")).toBeVisible();

    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls;
    });

    const paths = cached.map((url) => new URL(url).pathname);
    // Something must be cached, or the assertion below is vacuous.
    expect(paths.length).toBeGreaterThan(0);
    expect(paths).not.toContain("/");
    expect(paths.filter((path) => path.startsWith("/cars"))).toEqual([]);
    expect(paths.filter((path) => path.startsWith("/api"))).toEqual([]);
  });

  test("never serves the signed-in page from the cache when offline", async ({ page, context }) => {
    // AC-4 — the reason this plan exists.
    //
    // Assert the data is ABSENT, not merely that an offline page appeared. A
    // worker that cached the dashboard AND fell back to /offline.html would pass
    // a "shows the offline page" assertion while still leaking the account.
    await page.goto("/");
    await waitForServiceWorkerControl(page);
    // Deliberately a second visit, while still online and now controlled. With
    // only the first, a worker that caches HTML would have had nothing to store
    // yet, and this test would pass without proving anything.
    await page.goto("/");
    await expect(page.getByText("DEMO-0001")).toBeVisible();

    await context.setOffline(true);
    const response = await page.goto("/");

    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();

    const html = (await response?.text()) ?? "";
    expect(html).not.toContain("DEMO-0001");
    expect(html).not.toContain("Total across");
    expect(html).not.toMatch(/€[\d,.]+/);
  });

  test("still serves a precached icon when offline", async ({ page, context }) => {
    // AC-5. The counterweight to the test above: the boundary is narrow, not
    // "cache nothing" — an installed app whose icons 404 offline is broken too.
    await page.goto("/");
    await waitForServiceWorkerControl(page);

    await context.setOffline(true);

    const status = await page.evaluate(async () => {
      const response = await fetch("/icons/icon-192.png");
      return response.status;
    });

    expect(status).toBe(200);
  });
});
