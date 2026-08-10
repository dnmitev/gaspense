/**
 * Gaspense service worker.
 *
 * ⚠️ This is the one plain-JavaScript source file in the project, and it is a
 * deliberate documented exception to "TypeScript throughout" (see CLAUDE.md). A
 * service worker is fetched by the browser as a static file and is not part of
 * the TypeScript build graph; the alternatives are adding a compile step or
 * serving the script as a string from a route handler, and both are worse.
 *
 * Registered as a MODULE worker (`{ type: "module" }`), which is what lets
 * tests/unit/sw-policy.test.ts import the predicates below and drive them
 * directly. The browser and the test therefore run the same source, with no
 * build step and no second copy of the rule to keep in sync.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE CACHING RULE, AND WHY IT IS NARROW
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A service worker is a proxy that outlives the page that installed it. Every
 * page in this app sits behind a session and renders one user's rows, so a
 * cached navigation response would outlive the session that authorised it: the
 * app would keep serving a signed-in dashboard after sign-out, from a store the
 * server cannot reach or clear.
 *
 * So the cache is an allowlist of static assets, and nothing else:
 *
 *   - NEVER cache HTML. Navigations are network-only, falling back to the
 *     static /offline.html — never to a previous page.
 *   - NEVER cache /api/*, which is where auth lives.
 *   - NEVER cache a non-GET request.
 *   - NEVER cache a cross-origin or opaque response.
 *
 * This is a security boundary, not a performance setting. tests/e2e/pwa.spec.ts
 * proves it by going offline and asserting the user's data is ABSENT from what
 * comes back.
 */

/**
 * Bump this when the precache list below changes.
 *
 * `activate` deletes every cache whose name is not this one, so bumping is what
 * evicts the old entries. Nothing enforces it automatically.
 */
const CACHE_VERSION = "gaspense-static-v1";

/** Fetched and stored at install time, so they are there the first time the network is not. */
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/apple-touch-icon.png"];

/** Same-origin path prefixes that are safe to cache: immutable or content-free. */
const STATIC_PREFIXES = ["/_next/static/", "/icons/"];

/** Same-origin exact paths that are safe to cache. */
const STATIC_PATHS = [
  "/icon.svg",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/offline.html",
];

/**
 * True for a document navigation.
 *
 * Takes the request rather than the event so it is callable with a plain object
 * in a test, while the worker passes it the genuine Request.
 */
export function isNavigation(request) {
  return request.mode === "navigate";
}

/**
 * The allowlist. True only for a same-origin GET for a static asset.
 *
 * `origin` is passed in rather than read from `self.location` so the rule is a
 * pure function of its inputs and a test does not have to fake the worker's
 * global scope to exercise it.
 */
export function shouldCache(request, origin) {
  if (request.method !== "GET") return false;

  // HTML never enters the cache. This is the rule the whole file exists for.
  if (isNavigation(request)) return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (url.origin !== origin) return false;

  // Redundant against the allowlist below, and kept anyway: it means widening
  // the allowlist later cannot accidentally start caching authenticated JSON.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return false;

  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return true;
  return STATIC_PATHS.includes(url.pathname);
}

/** Cache-first for static assets: they are immutable or versioned by filename. */
async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // `basic` excludes opaque cross-origin responses, which cannot be inspected
  // and would poison the cache with something unreadable.
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Network-only, with the static offline page when the network is gone.
 *
 * The fallback is deliberately NOT a cached version of the requested page —
 * there is never one to fall back to, by the rule at the top of this file.
 */
async function networkThenOfflinePage(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_VERSION);
    const offline = await cache.match("/offline.html");
    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)),
      );
      // Control the page that registered us, rather than only the next one.
      await clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (isNavigation(request)) {
    event.respondWith(networkThenOfflinePage(request));
    return;
  }

  // Anything not on the allowlist is left entirely alone — no respondWith, so
  // the browser handles it natively and the worker never sees the response.
  if (!shouldCache(request, self.location.origin)) return;

  event.respondWith(fromCacheFirst(request));
});
