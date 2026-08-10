import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "./service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaspense",
  description:
    "Track the real total cost of vehicle ownership — fuel, maintenance, taxes, fines, and vignette.",
  // No <link rel="manifest"> here: Next emits it from app/manifest.ts.
  icons: {
    icon: "/icons/icon-192.png",
    // iOS ignores manifest icons entirely. Without this, an installed icon on
    // an iPhone is a screenshot of the page.
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Gaspense",
    // The status bar sits over the page in standalone mode; "default" keeps it
    // legible against the app's white background.
    statusBarStyle: "default",
  },
};

// Mobile-first: this app is primarily used on a phone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Matches the manifest's theme_color. Declared per scheme because the body
  // is white in light mode and neutral-950 in dark, and a single value tints
  // the browser chrome wrongly in one of them.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
