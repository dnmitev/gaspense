import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scaleBars } from "@/lib/chart";

// The degenerate cases are the point. A wrong bar height is visible; a NaN
// height is invisible — the attribute is dropped, the chart renders empty, and
// nothing throws.

describe("scaleBars", () => {
  it("maps the largest value to the full height", () => {
    expect(scaleBars([10, 20, 40], 100)).toEqual([25, 50, 100]);
  });

  it("scales proportionally", () => {
    // Half the max gets half the height.
    expect(scaleBars([50, 100], 80)).toEqual([40, 80]);
  });

  it("returns whole pixels so the markup is stable between renders", () => {
    for (const bar of scaleBars([1, 3, 7, 11], 100)) {
      expect(Number.isInteger(bar)).toBe(true);
    }
  });

  it("returns zeros for an all-zero series rather than NaN", () => {
    // The case that renders height="NaN" and silently draws nothing. A brand
    // new account with no expenses hits this on its first visit.
    const bars = scaleBars([0, 0, 0], 100);

    expect(bars).toEqual([0, 0, 0]);
    for (const bar of bars) expect(Number.isNaN(bar)).toBe(false);
  });

  it("returns an empty array for an empty series, not [NaN]", () => {
    expect(scaleBars([], 100)).toEqual([]);
  });

  it("gives a single value the full height", () => {
    expect(scaleBars([42], 100)).toEqual([100]);
  });

  it("clamps negatives to zero instead of emitting a negative height", () => {
    // Not reachable from the aggregation today — amounts are positive — but a
    // negative height attribute is dropped by the browser without complaint.
    expect(scaleBars([-5, 10], 100)).toEqual([0, 100]);
  });

  it("does not let a negative value become the maximum", () => {
    // Clamping before taking the max is what prevents an inverted chart.
    expect(scaleBars([-100, 5, 10], 100)).toEqual([0, 50, 100]);
  });

  it("survives non-finite values", () => {
    expect(scaleBars([Number.NaN, Number.POSITIVE_INFINITY, 10], 100)).toEqual([0, 0, 100]);
  });

  it("returns zeros for a non-positive or non-finite height", () => {
    expect(scaleBars([1, 2, 3], 0)).toEqual([0, 0, 0]);
    expect(scaleBars([1, 2, 3], -10)).toEqual([0, 0, 0]);
    expect(scaleBars([1, 2, 3], Number.NaN)).toEqual([0, 0, 0]);
  });

  it("handles a realistic twelve-month series", () => {
    const months = [
      21_040, 31_890, 18_500, 42_000, 12_300, 27_800, 9_900, 35_600, 15_200, 48_000, 22_100, 30_500,
    ];
    const bars = scaleBars(months, 60);

    expect(bars).toHaveLength(12);
    expect(Math.max(...bars)).toBe(60);
    expect(Math.min(...bars)).toBeGreaterThan(0);
    for (const bar of bars) expect(bar).toBeLessThanOrEqual(60);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    scaleBars(values, 10);

    expect(values).toEqual([3, 1, 2]);
  });
});

describe("lib/chart.ts is dependency-free", () => {
  it("imports nothing", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/chart.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/prisma|generated/i);
  });
});
