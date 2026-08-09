import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDemoData,
  DECREASING_READING_INDEX,
  DEMO_CAR,
  DEMO_PLATE,
  MISSING_READING_INDEX,
  PARTIAL_FILL_INDEX,
  type DemoExpense,
} from "@/lib/demo-data";
import { DEFAULT_CATEGORIES } from "@/lib/seed-categories";
import { MAX_AMOUNT_CENTS } from "@/lib/validation/expense";

// The dataset is the part of a seed worth testing hard. An INSERT either works
// or throws; a dataset that is subtly wrong looks entirely fine and then
// misleads every calculation developed against it.

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

const fuelFills = (expenses: DemoExpense[]) =>
  expenses.filter((expense) => expense.categoryName === "Fuel");

describe("buildDemoData — determinism", () => {
  it("returns identical data for the same anchor", () => {
    // AC-3. Without this the only assertions possible would be about counts,
    // which is exactly the level at which a wrong dataset passes.
    expect(buildDemoData(ANCHOR)).toEqual(buildDemoData(ANCHOR));
  });

  it("shifts the dates for a different anchor but keeps the shape", () => {
    const first = buildDemoData(ANCHOR);
    const second = buildDemoData(new Date("2026-06-16T00:00:00.000Z"));

    expect(second.expenses).toHaveLength(first.expenses.length);
    expect(second.expenses.map((expense) => expense.amountCents)).toEqual(
      first.expenses.map((expense) => expense.amountCents),
    );
    expect(second.expenses[0].date.getTime()).toBe(first.expenses[0].date.getTime() + 86_400_000);
  });

  it("ignores any time component on the anchor", () => {
    // The anchor is normalised to UTC midnight, so a caller passing "now" does
    // not get dates a few hours off — enough to move a fill into the previous
    // month for anyone west of UTC.
    const midday = buildDemoData(new Date("2026-06-15T13:47:02.000Z"));

    expect(midday).toEqual(buildDemoData(ANCHOR));
  });

  it("contains no source of nondeterminism", () => {
    // Comment-stripped: the module's own prose mentions Math.random and
    // Date.now precisely to say it does not call them, so a raw grep would
    // match the explanation rather than the code.
    // Resolved from the working directory: the unit project runs under jsdom,
    // where `import.meta.url` is not a file: URL and readFileSync rejects it.
    const source = readFileSync(resolve(process.cwd(), "lib/demo-data.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/new Date\(\s*\)/);
    // And no database reach — this is why the module is separate at all.
    expect(source).not.toMatch(/prisma|generated/i);
  });
});

describe("buildDemoData — the deliberate edge cases", () => {
  // AC-4. These exist so plan 03-02 develops against data that can actually
  // break it. Asserted by count, so a later "tidy-up" that removes one fails.

  it("includes exactly one partial fill", () => {
    const partial = fuelFills(buildDemoData(ANCHOR).expenses).filter(
      (fill) => fill.fullTank === false,
    );

    expect(partial).toHaveLength(1);
    expect(partial[0].notes).toBe("Partial top-up");
  });

  it("includes exactly one fill with no odometer reading", () => {
    const withoutReading = fuelFills(buildDemoData(ANCHOR).expenses).filter(
      (fill) => fill.odometer === undefined,
    );

    expect(withoutReading).toHaveLength(1);
  });

  it("includes exactly one reading lower than the one before it", () => {
    const readings = fuelFills(buildDemoData(ANCHOR).expenses)
      .map((fill) => fill.odometer)
      .filter((reading): reading is number => reading !== undefined);

    const drops = readings.filter((reading, index) => index > 0 && reading < readings[index - 1]);

    expect(drops).toHaveLength(1);
  });

  it("returns to the true series after the mis-keyed reading", () => {
    // A transposed digit, not a replaced odometer: the following fill carries
    // on from where the real mileage had reached. That is the harder case for a
    // consumption calculation than a permanent reset, which is why it is this.
    const fills = fuelFills(buildDemoData(ANCHOR).expenses);
    const before = fills[DECREASING_READING_INDEX - 1].odometer;
    const at = fills[DECREASING_READING_INDEX].odometer;
    const after = fills[DECREASING_READING_INDEX + 1].odometer;

    expect(at).toBeLessThan(before as number);
    expect(after).toBeGreaterThan(before as number);
  });

  it("puts the three irregularities on distinct fills", () => {
    // Overlapping them would quietly reduce three test cases to two.
    const indices = [PARTIAL_FILL_INDEX, MISSING_READING_INDEX, DECREASING_READING_INDEX];

    expect(new Set(indices).size).toBe(3);
  });

  it("leaves the remaining fills usable as consumption endpoints", () => {
    const usable = fuelFills(buildDemoData(ANCHOR).expenses).filter(
      (fill) => fill.fullTank === true && fill.odometer !== undefined,
    );

    expect(usable.length).toBeGreaterThan(20);
  });
});

describe("buildDemoData — plausibility and safety", () => {
  it("spans about twelve months", () => {
    const { expenses } = buildDemoData(ANCHOR);
    const first = expenses[0].date.getTime();
    const last = expenses[expenses.length - 1].date.getTime();
    const days = (last - first) / 86_400_000;

    expect(days).toBeGreaterThan(330);
    expect(days).toBeLessThan(380);
  });

  it("ends on the anchor day, so the current month is never empty", () => {
    const { expenses } = buildDemoData(ANCHOR);
    const last = expenses[expenses.length - 1].date;

    expect(last.toISOString()).toBe(ANCHOR.toISOString());
  });

  it("only uses categories that are actually seeded", () => {
    // createExpense refuses a category it cannot see, so a name invented here
    // would fail at seed time with a message about ownership rather than about
    // the typo that caused it.
    const names = new Set(buildDemoData(ANCHOR).expenses.map((expense) => expense.categoryName));

    for (const name of names) {
      expect(DEFAULT_CATEGORIES).toContain(name);
    }
  });

  it("uses positive integer amounts within the schema's limit", () => {
    for (const expense of buildDemoData(ANCHOR).expenses) {
      expect(Number.isInteger(expense.amountCents)).toBe(true);
      expect(expense.amountCents).toBeGreaterThan(0);
      expect(expense.amountCents).toBeLessThan(MAX_AMOUNT_CENTS);
    }
  });

  it("uses positive litres on every fuel row and none elsewhere", () => {
    for (const expense of buildDemoData(ANCHOR).expenses) {
      if (expense.categoryName === "Fuel") expect(expense.liters).toBeGreaterThan(0);
      else expect(expense.liters).toBeUndefined();
    }
  });

  it("gives litres a decimal, so fills do not look synthetic", () => {
    // An earlier version rounded to whole litres, which every fill silently
    // became. Nobody puts in exactly 41 litres, and a consumption figure
    // derived from whole litres is quietly less precise than the real thing.
    const fills = fuelFills(buildDemoData(ANCHOR).expenses);
    const fractional = fills.filter((fill) => !Number.isInteger(fill.liters as number));

    expect(fractional.length).toBeGreaterThan(fills.length / 2);
  });

  it("keeps each fill's amount consistent with a believable price per litre", () => {
    // amountCents / liters must land in a plausible €/L band. This is what
    // catches a scaling mistake in either field — a wrong litres figure and a
    // wrong amount are individually plausible, their ratio is not.
    for (const fill of fuelFills(buildDemoData(ANCHOR).expenses)) {
      const centsPerLiter = fill.amountCents / (fill.liters as number);

      expect(centsPerLiter).toBeGreaterThan(150);
      expect(centsPerLiter).toBeLessThan(200);
    }
  });

  it("keeps odometer readings whole and positive", () => {
    const { expenses, readings } = buildDemoData(ANCHOR);

    for (const expense of expenses) {
      if (expense.odometer === undefined) continue;
      expect(Number.isInteger(expense.odometer)).toBe(true);
      expect(expense.odometer).toBeGreaterThan(0);
    }

    for (const reading of readings) {
      expect(Number.isInteger(reading.reading)).toBe(true);
      expect(reading.reading).toBeGreaterThan(0);
    }
  });

  it("carries only obvious placeholder identity", () => {
    // Public repository: no real plate, no real business, no address.
    const { car, expenses } = buildDemoData(ANCHOR);

    expect(car.licensePlate).toBe(DEMO_PLATE);
    expect(DEMO_CAR.licensePlate).toMatch(/^DEMO-/);

    for (const station of expenses.map((expense) => expense.station)) {
      if (station === undefined) continue;
      expect(station).toMatch(/Demo|Sample|Placeholder/);
    }
  });

  it("produces a total large enough to be worth reporting on", () => {
    // A sanity floor, not a pinned figure: pinning the exact total here would
    // make every future tweak to the dataset look like a regression.
    const { expenses } = buildDemoData(ANCHOR);
    const total = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

    expect(total).toBeGreaterThan(200_000);
  });
});
