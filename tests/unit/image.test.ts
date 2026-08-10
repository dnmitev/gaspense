import { describe, expect, it } from "vitest";
import { MAX_IMAGE_EDGE, scaleToFit } from "@/lib/image";

/**
 * The downscale arithmetic, with no canvas and no DOM.
 *
 * The drawing lives in a client component and needs a browser; this is the part
 * that decides the numbers, and it is the part that can be wrong quietly.
 */

describe("scaleToFit", () => {
  it("leaves an image already within the limit untouched", () => {
    // Never upscale: re-encoding a small photo larger costs bytes and adds
    // nothing at all.
    expect(scaleToFit({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });

  it("leaves an image exactly at the limit untouched", () => {
    expect(scaleToFit({ width: MAX_IMAGE_EDGE, height: 900 })).toEqual({
      width: MAX_IMAGE_EDGE,
      height: 900,
    });
  });

  it("caps the long edge of a landscape photo and keeps the ratio", () => {
    // A typical 12MP phone photo, 4:3.
    const result = scaleToFit({ width: 4032, height: 3024 });

    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);
    expect(result.width / result.height).toBeCloseTo(4032 / 3024, 5);
  });

  it("caps the long edge of a portrait photo — height, not width", () => {
    const result = scaleToFit({ width: 3024, height: 4032 });

    expect(result.height).toBe(1600);
    expect(result.width).toBe(1200);
  });

  it("handles a square image", () => {
    expect(scaleToFit({ width: 3000, height: 3000 })).toEqual({ width: 1600, height: 1600 });
  });

  it("never lets a very wide image round its short edge to zero", () => {
    // 10000x3 scaled by 0.16 gives 0.48, which rounds to 0 — and a canvas of
    // height 0 cannot be drawn. The floor at 1 is what stops that.
    const result = scaleToFit({ width: 10_000, height: 3 });

    expect(result.width).toBe(1600);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("respects a custom maximum edge", () => {
    expect(scaleToFit({ width: 2000, height: 1000 }, 500)).toEqual({ width: 500, height: 250 });
  });

  it("refuses a zero or negative dimension rather than producing nonsense", () => {
    expect(() => scaleToFit({ width: 0, height: 100 })).toThrow(/zero or negative/);
    expect(() => scaleToFit({ width: 100, height: -1 })).toThrow(/zero or negative/);
  });
});
