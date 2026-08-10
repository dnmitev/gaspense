"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. Renders nothing.
 *
 * ⚠️ This is the app's first layout-level client boundary, and the app shipping
 * almost no client JavaScript is its best property. There is no server-side way
 * to register a worker, so this is the price of installability — kept to the
 * floor deliberately: no state, no props, no imports beyond `useEffect`, and it
 * returns null.
 *
 * PRODUCTION ONLY. In `next dev` the chunks under /_next/static are unhashed and
 * change on every edit, so a cache-first worker would serve yesterday's chunk
 * and break hot reload in a way that looks like a compiler bug. The e2e suite
 * runs against a production build (`npm run build && npm start`), so the worker
 * is still fully covered by tests.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Module worker: public/sw.js uses `export`, which a classic worker cannot
    // parse. That export is what makes its caching rule unit-testable.
    navigator.serviceWorker.register("/sw.js", { type: "module" }).catch((error) => {
      // A failed registration must never take the page down with it — the app
      // works fine without a worker, it just is not installable.
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
