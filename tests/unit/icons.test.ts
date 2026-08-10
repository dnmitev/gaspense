import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

/**
 * The icons are the size the manifest claims they are.
 *
 * A manifest that declares 512x512 over a 192px file reads fine, reviews fine,
 * and silently fails installability in a browser. The declared sizes are
 * therefore checked against the real PNG headers rather than trusted — and the
 * assertions are driven FROM the manifest, so editing it without running
 * `npm run icons:generate` fails here.
 */

const publicDir = join(process.cwd(), "public");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width and height out of a PNG's IHDR chunk, which is always first. */
function pngDimensions(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);

  expect(bytes.subarray(0, 8), `${file} is not a PNG`).toEqual(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString("ascii"), `${file} has no IHDR`).toBe("IHDR");

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("manifest icons", () => {
  const icons = manifest().icons ?? [];

  it("declares at least one 192px and one 512px icon", () => {
    const sizes = icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("declares a maskable icon", () => {
    // Without one, Android letterboxes the "any" icon inside a white circle.
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it.each(icons.map((icon) => [icon.src, icon.sizes] as const))("%s really is %s", (src, sizes) => {
    const [declaredWidth, declaredHeight] = String(sizes).split("x").map(Number);
    const actual = pngDimensions(join(publicDir, String(src)));

    expect(actual.width).toBe(declaredWidth);
    expect(actual.height).toBe(declaredHeight);
  });
});

describe("apple touch icon", () => {
  it("is a 180x180 PNG", () => {
    // Not in the manifest — iOS ignores manifest icons entirely and reads only
    // the <link rel="apple-touch-icon"> that app/layout.tsx emits. 180 is the
    // size iOS asks for at 3x.
    expect(pngDimensions(join(publicDir, "apple-touch-icon.png"))).toEqual({
      width: 180,
      height: 180,
    });
  });
});
