import { describe, expect, it } from "vitest";
import { isNavigation, shouldCache } from "@/public/sw.js";

/**
 * The service worker's caching rule, driven directly.
 *
 * These import the same file the browser registers — public/sw.js is a module
 * worker precisely so this is possible, and so there is no second copy of the
 * rule to drift from the real one.
 *
 * Each rejection gets its own named test rather than a table of falsy inputs.
 * A single "returns false for anything unsafe" case goes red without saying
 * which rule broke, and the rules protect different things.
 */

const ORIGIN = "https://gaspense.example";

/** The shape the worker actually passes: a Request satisfies this structurally. */
function request(url: string, init: { method?: string; mode?: string } = {}) {
  return {
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    url: url.startsWith("http") ? url : `${ORIGIN}${url}`,
  };
}

describe("isNavigation", () => {
  it("is true for a document navigation", () => {
    expect(isNavigation(request("/", { mode: "navigate" }))).toBe(true);
  });

  it("is false for a subresource fetch", () => {
    expect(isNavigation(request("/icons/icon-192.png"))).toBe(false);
  });
});

describe("shouldCache — what may be cached", () => {
  it("caches Next's immutable static chunks", () => {
    expect(shouldCache(request("/_next/static/chunks/main-abc123.js"), ORIGIN)).toBe(true);
  });

  it("caches the app icons", () => {
    expect(shouldCache(request("/icons/icon-192.png"), ORIGIN)).toBe(true);
    expect(shouldCache(request("/apple-touch-icon.png"), ORIGIN)).toBe(true);
    expect(shouldCache(request("/icon.svg"), ORIGIN)).toBe(true);
  });

  it("caches the manifest and the offline page", () => {
    expect(shouldCache(request("/manifest.webmanifest"), ORIGIN)).toBe(true);
    expect(shouldCache(request("/offline.html"), ORIGIN)).toBe(true);
  });
});

describe("shouldCache — what must never be cached", () => {
  it("never caches a navigation to the dashboard", () => {
    // The whole reason this file exists. A cached "/" outlives the session that
    // authorised it and survives sign-out.
    expect(shouldCache(request("/", { mode: "navigate" }), ORIGIN)).toBe(false);
  });

  it("never caches a navigation to a car's expenses", () => {
    expect(shouldCache(request("/cars/abc123/expenses", { mode: "navigate" }), ORIGIN)).toBe(false);
  });

  it("refuses a navigation even to a path that IS on the allowlist", () => {
    // ⚠️ The two tests above pass on the ALLOWLIST alone — no app page is on it,
    // so deleting the `isNavigation` guard from shouldCache leaves them green.
    // Measured by mutation, not assumed.
    //
    // This one is the guard's own test: /offline.html is allowlisted, so only
    // the navigation check can refuse it. Which means the guard survives
    // someone widening the allowlist later, which is exactly its job.
    expect(shouldCache(request("/offline.html", { mode: "navigate" }), ORIGIN)).toBe(false);
    // ...and the same path as a subresource is still cacheable, so the test
    // above is not passing because the path is simply unreachable.
    expect(shouldCache(request("/offline.html"), ORIGIN)).toBe(true);
  });

  it("never caches the auth session endpoint", () => {
    // Passes on the allowlist alone — /api is not on it and cannot be, given
    // every entry is rooted elsewhere. The explicit /api check in sw.js is
    // unreachable defence-in-depth, and is documented there as such rather than
    // dressed up as load-bearing here.
    expect(shouldCache(request("/api/auth/session"), ORIGIN)).toBe(false);
    expect(shouldCache(request("/api/anything.png"), ORIGIN)).toBe(false);
  });

  it("never caches a non-GET request, even to a static path", () => {
    // Server actions POST to page URLs; nothing that mutates may be replayed
    // from a cache.
    expect(shouldCache(request("/icons/icon-192.png", { method: "POST" }), ORIGIN)).toBe(false);
    expect(shouldCache(request("/", { method: "POST" }), ORIGIN)).toBe(false);
  });

  it("never caches a cross-origin request, even for a matching path", () => {
    expect(shouldCache(request("https://evil.example/icons/icon-192.png"), ORIGIN)).toBe(false);
  });

  it("never caches a same-origin path that is not on the allowlist", () => {
    // The allowlist is the rule. An unfamiliar path is refused rather than
    // guessed about.
    expect(shouldCache(request("/robots.txt"), ORIGIN)).toBe(false);
  });

  it("refuses a malformed URL rather than throwing", () => {
    // Built by hand: the helper above would turn this into a valid absolute URL
    // and the test would pass for the wrong reason.
    expect(shouldCache({ method: "GET", mode: "no-cors", url: "not-a-url" }, ORIGIN)).toBe(false);
  });
});
