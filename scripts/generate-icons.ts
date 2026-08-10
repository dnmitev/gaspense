/**
 * Rasterises public/icon.svg into the PNGs the manifest and iOS need.
 *
 * Run: npm run icons:generate
 *
 * Why Playwright rather than sharp/resvg/@resvg/resvg-js: @playwright/test is
 * already a devDependency and its Chromium is already installed, here and in
 * CI. Four icons do not justify taking an image-processing dependency, and this
 * project has a standing preference for hand-rolling over adding one.
 *
 * The PNGs are committed. Vercel serves public/ statically and never runs this
 * script, so they have to be in the repository — a deliberate, narrow exception
 * to "do not commit generated output". This script is what keeps them
 * reproducible when the SVG changes, and tests/unit/icons.test.ts is what
 * catches it if they drift from what the manifest claims.
 */

import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(repoRoot, "public");

/** neutral-900 — the same ink the app's primary buttons use. */
const BACKGROUND = "#171717";

type IconSpec = {
  /** Path relative to public/. */
  file: string;
  size: number;
  /**
   * Fraction of the canvas the glyph occupies.
   *
   * Android masks a maskable icon down to an arbitrary shape and only the inner
   * 80% is guaranteed to survive, so the maskable variant draws smaller.
   */
  glyphScale: number;
  /** Fraction of the canvas used as corner radius. */
  radius: number;
};

const ICONS: IconSpec[] = [
  { file: "icons/icon-192.png", size: 192, glyphScale: 0.76, radius: 0.22 },
  { file: "icons/icon-512.png", size: 512, glyphScale: 0.76, radius: 0.22 },
  // Full-bleed square: the launcher applies the mask, so rounding here would be
  // rounded twice and the corners would show background through the gap.
  //
  // The smaller glyph is the safe zone, not a style choice — only the inner 80%
  // of a maskable icon is guaranteed to survive the mask.
  { file: "icons/icon-maskable-512.png", size: 512, glyphScale: 0.58, radius: 0 },
  // iOS ignores the manifest entirely and applies its own mask to this file.
  { file: "apple-touch-icon.png", size: 180, glyphScale: 0.72, radius: 0 },
];

function page(svg: string, spec: IconSpec): string {
  const glyph = Math.round(spec.size * spec.glyphScale);
  const radius = Math.round(spec.size * spec.radius);

  return `<!doctype html>
<html>
  <head>
    <style>
      /* The glyph fills the box it is given. icon.svg carries a viewBox and no
         width/height precisely so this rule can size it. */
      svg { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body style="margin:0">
    <div style="
      width:${spec.size}px;
      height:${spec.size}px;
      background:${BACKGROUND};
      border-radius:${radius}px;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
    ">
      <div style="width:${glyph}px;height:${glyph}px">${svg}</div>
    </div>
  </body>
</html>`;
}

async function main(): Promise<void> {
  const svg = await readFile(join(publicDir, "icon.svg"), "utf8");

  const browser = await chromium.launch();
  try {
    for (const spec of ICONS) {
      const target = join(publicDir, spec.file);
      await mkdir(dirname(target), { recursive: true });

      const context = await browser.newContext({
        viewport: { width: spec.size, height: spec.size },
        // 1, explicitly. A retina default would silently produce a 384px file
        // for a 192px spec — exactly the mismatch icons.test.ts exists to catch.
        deviceScaleFactor: 1,
      });
      const tab = await context.newPage();
      await tab.setContent(page(svg, spec));
      await tab.screenshot({ path: target });
      await context.close();

      console.log(`wrote public/${spec.file} (${spec.size}x${spec.size})`);
    }
  } finally {
    await browser.close();
  }
}

await main();
