import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at /manifest.webmanifest.
 *
 * Next's file convention rather than a static public/manifest.json, so the type
 * checker catches a malformed manifest during `next build` instead of a browser
 * silently declining to offer installation.
 *
 * This route is deliberately reachable without a session. Every *page* in the
 * app redirects to /signin, but a manifest the browser cannot fetch before
 * sign-in means the app is never installable — and it carries nothing private.
 *
 * ⚠️ The declared icon sizes are asserted against the actual PNG headers in
 * tests/unit/icons.test.ts. Changing a size here without regenerating
 * (`npm run icons:generate`) fails that test rather than failing quietly in a
 * browser six weeks later.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gaspense",
    short_name: "Gaspense",
    description:
      "Track the real total cost of vehicle ownership — fuel, maintenance, taxes, fines, and vignette.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The app's real page background, so the splash screen does not flash a
    // colour that appears nowhere in the app.
    background_color: "#ffffff",
    // Same value as the light-scheme themeColor in app/layout.tsx. Deliberately
    // matched: the installed app's status bar and the browser's chrome tinting
    // the same page differently reads as a bug.
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android masks launcher icons to an arbitrary shape. Without a
        // maskable variant it letterboxes the "any" icon inside a white circle.
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
