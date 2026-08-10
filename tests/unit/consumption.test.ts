import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildConsumption, type FuelFill, type Reading } from "@/lib/consumption";
import {
  buildDemoData,
  DECREASING_READING_INDEX,
  MISSING_READING_INDEX,
  PARTIAL_FILL_INDEX,
} from "@/lib/demo-data";

// Every failure mode here produces a plausible number rather than an error, so
// the numbers below are hand-computed and written out. An assertion that only
// checked "a figure appeared" would pass against most of the ways this can be
// wrong.

const DAY = 86_400_000;
const START = new Date("2026-01-01T00:00:00.000Z").getTime();

function fill(
  dayOffset: number,
  liters: number,
  options: { full?: boolean; odometer?: number; cents?: number } = {},
): FuelFill {
  return {
    date: new Date(START + dayOffset * DAY),
    liters,
    amountCents: options.cents ?? Math.round(liters * 175),
    fullTank: options.full ?? true,
    ...(options.odometer === undefined ? {} : { odometer: options.odometer }),
  };
}

const reading = (dayOffset: number, km: number): Reading => ({
  date: new Date(START + dayOffset * DAY),
  reading: km,
});

describe("buildConsumption — the full-to-full method", () => {
  it("absorbs a partial fill's litres into the interval", () => {
    // AC-1. Opening full tank at 142,000. Then 41.2, a 22.5 partial, and a
    // closing full tank of 44.0 at 143,400.
    //   distance 1,400 km · litres 41.2 + 22.5 + 44.0 = 107.7 → 7.6929 L/100km
    // Dropping the partial would give 6.09 — 21% low, and entirely believable.
    const result = buildConsumption(
      [
        fill(0, 40, { odometer: 142_000 }),
        fill(10, 41.2),
        fill(20, 22.5, { full: false }),
        fill(30, 44.0, { odometer: 143_400 }),
      ],
      [],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].distanceKm).toBe(1_400);
    expect(result.intervals[0].liters).toBeCloseTo(107.7, 6);
    expect(result.intervals[0].litersPer100Km).toBeCloseTo(7.6929, 3);
  });

  it("spans a full tank that has no odometer reading", () => {
    // AC-2: the middle fill cannot be an endpoint, but its fuel was still burned.
    //   distance 2,000 km · litres 45 + 50 = 95 → 4.75 L/100km
    const result = buildConsumption(
      [fill(0, 40, { odometer: 150_000 }), fill(10, 45), fill(20, 50, { odometer: 152_000 })],
      [],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].distanceKm).toBe(2_000);
    expect(result.intervals[0].liters).toBeCloseTo(95, 6);
    expect(result.intervals[0].litersPer100Km).toBeCloseTo(4.75, 6);
  });

  it("never ends an interval at a partial fill, even one carrying a reading", () => {
    // AC-3. The reading makes it look usable; the tank was not full, so it is
    // not. If this regressed, two short intervals would appear instead of one.
    const result = buildConsumption(
      [
        fill(0, 40, { odometer: 100_000 }),
        fill(10, 30, { full: false, odometer: 100_500 }),
        fill(20, 40, { odometer: 101_000 }),
      ],
      [],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].fromKm).toBe(100_000);
    expect(result.intervals[0].toKm).toBe(101_000);
    expect(result.intervals[0].liters).toBeCloseTo(70, 6);
  });

  it("absorbs a backwards reading instead of breaking the series", () => {
    // AC-4, using the fixture's real shape: 155,986 → 155,212 (transposed
    // digit) → 156,998. One interval of 1,012 km carrying both fills' litres.
    const result = buildConsumption(
      [
        fill(0, 52.5, { odometer: 155_986 }),
        fill(10, 36.1, { odometer: 155_212 }),
        fill(20, 42.9, { odometer: 156_998 }),
      ],
      [],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].fromKm).toBe(155_986);
    expect(result.intervals[0].toKm).toBe(156_998);
    expect(result.intervals[0].distanceKm).toBe(1_012);
    expect(result.intervals[0].liters).toBeCloseTo(79, 6);
    expect(result.intervals[0].litersPer100Km).toBeCloseTo(7.806, 3);
  });

  it("produces no negative or non-finite figure from a bad reading", () => {
    const result = buildConsumption(
      [
        fill(0, 40, { odometer: 200_000 }),
        fill(10, 40, { odometer: 190_000 }),
        fill(20, 40, { odometer: 201_000 }),
      ],
      [],
    );

    for (const interval of result.intervals) {
      expect(interval.distanceKm).toBeGreaterThan(0);
      expect(Number.isFinite(interval.litersPer100Km)).toBe(true);
      expect(interval.litersPer100Km).toBeGreaterThan(0);
    }
  });

  it("treats two identical readings as no distance and does not close there", () => {
    const result = buildConsumption(
      [
        fill(0, 40, { odometer: 300_000 }),
        fill(10, 20, { odometer: 300_000 }),
        fill(20, 30, { odometer: 300_600 }),
      ],
      [],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].distanceKm).toBe(600);
    expect(result.intervals[0].liters).toBeCloseTo(50, 6);
  });

  it("discards fills before the first usable endpoint", () => {
    // Their fuel covered an unknown distance; counting it against the first
    // interval would inflate that interval's consumption.
    const result = buildConsumption(
      [
        fill(0, 99),
        fill(5, 88, { full: false }),
        fill(10, 40, { odometer: 10_000 }),
        fill(20, 45, { odometer: 10_600 }),
      ],
      [],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].liters).toBeCloseTo(45, 6);
  });

  it("carries each interval's cost through without dividing it", () => {
    const result = buildConsumption(
      [
        fill(0, 40, { odometer: 1_000, cents: 7_000 }),
        fill(10, 30, { cents: 5_250 }),
        fill(20, 20, { odometer: 1_500, cents: 3_500 }),
      ],
      [],
    );

    expect(result.intervals[0].costCents).toBe(5_250 + 3_500);
    expect(Number.isInteger(result.intervals[0].costCents)).toBe(true);
  });
});

describe("buildConsumption — the average", () => {
  it("weights by distance rather than averaging the rates", () => {
    // A short thirsty interval and a long economical one. The distance-weighted
    // answer is 5.83 L/100km; the naive mean of the two rates is 7.50.
    //   40 km on 4 L   → 10.0 L/100km
    //   960 km on 54 L →  5.625 L/100km
    //   weighted: 58 L over 1000 km → 5.8
    const result = buildConsumption(
      [
        fill(0, 30, { odometer: 0 }),
        fill(1, 4, { odometer: 40 }),
        fill(2, 54, { odometer: 1_000 }),
      ],
      [],
    );

    expect(result.intervals).toHaveLength(2);
    expect(result.averageLitersPer100Km).toBeCloseTo(5.8, 6);

    const naiveMean =
      result.intervals.reduce((sum, i) => sum + i.litersPer100Km, 0) / result.intervals.length;
    expect(naiveMean).toBeCloseTo(7.8125, 3);
    // Explicitly different, so a later "simplification" to mean(rates) fails.
    expect(result.averageLitersPer100Km).not.toBeCloseTo(naiveMean, 2);
  });

  it("returns null rather than zero when nothing can be measured", () => {
    // AC-7 at the calculation layer: unknown is not the same as 0.0.
    expect(buildConsumption([], []).averageLitersPer100Km).toBeNull();
    expect(buildConsumption([fill(0, 40, { odometer: 1 })], []).averageLitersPer100Km).toBeNull();
    expect(buildConsumption([fill(0, 40), fill(10, 40)], []).averageLitersPer100Km).toBeNull();
  });

  it("returns empty structures for empty input", () => {
    expect(buildConsumption([], [])).toEqual({
      intervals: [],
      totalLiters: 0,
      totalDistanceKm: 0,
      averageLitersPer100Km: null,
      distanceForCostKm: null,
    });
  });
});

describe("buildConsumption — distance for cost per km", () => {
  it("spans the earliest and latest credible readings", () => {
    const result = buildConsumption([], [reading(0, 10_000), reading(10, 12_000)]);

    expect(result.distanceForCostKm).toBe(2_000);
  });

  it("ignores a mis-keyed low reading instead of treating it as the start", () => {
    // AC-6. Raw min/max would give 20,000 - 8,000 = 12,000 km and understate
    // cost per kilometre by a third.
    const result = buildConsumption(
      [],
      [reading(0, 10_000), reading(10, 8_000), reading(20, 20_000)],
    );

    expect(result.distanceForCostKm).toBe(10_000);
  });

  it("returns null with fewer than two readings, or no movement", () => {
    expect(buildConsumption([], []).distanceForCostKm).toBeNull();
    expect(buildConsumption([], [reading(0, 5_000)]).distanceForCostKm).toBeNull();
    expect(
      buildConsumption([], [reading(0, 5_000), reading(5, 5_000)]).distanceForCostKm,
    ).toBeNull();
  });
});

describe("buildConsumption — against the real demo fixture", () => {
  // Both modules are pure, so the generated dataset can be run through the
  // calculation with no database. This is where the three deliberate
  // irregularities meet the code written to survive them.
  const dataset = buildDemoData(new Date("2026-06-15T00:00:00.000Z"));
  const fills: FuelFill[] = dataset.expenses
    .filter((expense) => expense.categoryName === "Fuel")
    .map((expense) => ({
      date: expense.date,
      amountCents: expense.amountCents,
      liters: expense.liters as number,
      fullTank: expense.fullTank ?? false,
      ...(expense.odometer === undefined ? {} : { odometer: expense.odometer }),
    }));
  const readings: Reading[] = [
    ...fills
      .filter((f) => f.odometer !== undefined)
      .map((f) => ({ date: f.date, reading: f.odometer as number })),
    ...dataset.readings,
  ];

  const result = buildConsumption(fills, readings);

  it("produces a believable average for a diesel", () => {
    expect(result.averageLitersPer100Km).not.toBeNull();
    expect(result.averageLitersPer100Km as number).toBeGreaterThan(4);
    expect(result.averageLitersPer100Km as number).toBeLessThan(14);
  });

  it("produces fewer intervals than fills, and every one finite and positive", () => {
    expect(result.intervals.length).toBeGreaterThan(15);
    expect(result.intervals.length).toBeLessThan(fills.length);

    for (const interval of result.intervals) {
      expect(interval.distanceKm).toBeGreaterThan(0);
      expect(interval.liters).toBeGreaterThan(0);
      expect(Number.isFinite(interval.litersPer100Km)).toBe(true);
      expect(interval.litersPer100Km).toBeGreaterThan(2);
      expect(interval.litersPer100Km).toBeLessThan(30);
    }
  });

  it("ends no interval at any of the three deliberate irregularities", () => {
    const partialKm = fills[PARTIAL_FILL_INDEX].odometer;
    const decreasingKm = fills[DECREASING_READING_INDEX].odometer;

    expect(fills[MISSING_READING_INDEX].odometer).toBeUndefined();

    for (const interval of result.intervals) {
      expect(interval.toKm).not.toBe(partialKm);
      expect(interval.toKm).not.toBe(decreasingKm);
      expect(interval.fromKm).not.toBe(partialKm);
      expect(interval.fromKm).not.toBe(decreasingKm);
    }
  });

  it("spans the mis-keyed reading with exactly one interval", () => {
    const before = fills[DECREASING_READING_INDEX - 1].odometer as number;
    const after = fills[DECREASING_READING_INDEX + 1].odometer as number;

    const spanning = result.intervals.filter(
      (interval) => interval.fromKm === before && interval.toKm === after,
    );

    expect(spanning).toHaveLength(1);
    expect(spanning[0].distanceKm).toBe(after - before);
  });
});

describe("lib/consumption.ts is database-free and money-free", () => {
  it("imports nothing and divides no money", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/consumption.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/prisma|generated/i);
    // Cost per distance is a money conversion and belongs in lib/money.ts.
    expect(source).not.toMatch(/costCents\s*\//);
    expect(source).not.toMatch(/formatEur/);
  });
});
