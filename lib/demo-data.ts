/**
 * The demo dataset: roughly twelve months of vehicle history, as a pure
 * function of an anchor date.
 *
 * ## Why this is separate from `lib/seed-demo.ts`
 *
 * Same split as `lib/aggregation.ts` / `lib/reports.ts`, for the same reason:
 * this file imports nothing — no Prisma client, no generated types, no session
 * — so `npm test` proves it with Docker stopped. The part of a seed most worth
 * testing is the shape of the data, not the INSERT statements.
 *
 * ## Determinism is a requirement, not a nicety
 *
 * Nothing here calls `Math.random()`, `Date.now()`, or `new Date()` with no
 * argument. Every value is a function of `anchor` and the constants below.
 * That is what lets a test pin an anchor and assert a hand-computed total; with
 * an unseeded random, the only assertions possible would be about counts and
 * shapes, which is precisely the level at which a wrong dataset looks right.
 *
 * ## The awkward cases are deliberate
 *
 * A tidy series of full tanks with neat ascending readings would hide the bugs
 * plan 03-02 has to survive. So this dataset contains, on purpose: one partial
 * fill, one fill with no odometer reading at all, and one reading LOWER than
 * the one before it. Odometer readings are explicitly not required to increase
 * — odometers get replaced, corrected and mis-keyed — and a consumption
 * calculation that assumes otherwise is wrong in a way that only shows up
 * against real data.
 *
 * ## Public repository
 *
 * Every value here is an obvious placeholder. No real licence plate, no real
 * address, no real business name, and no email address of any kind.
 */

/** Amounts are integer cents throughout; `lib/money.ts` stays the only converter. */

/** The marker identifying the demo car. Everything destructive keys off this. */
export const DEMO_PLATE = "DEMO-0001";

/** Obvious placeholders — see the note about this being a public repository. */
export const DEMO_CAR = {
  licensePlate: DEMO_PLATE,
  nickname: "Demo car",
  make: "Examplemobile",
  model: "Placeholder 2.0",
  year: 2019,
  fuelType: "DIESEL",
} as const;

export type DemoExpense = {
  categoryName: string;
  amountCents: number;
  date: Date;
  notes?: string;
  liters?: number;
  station?: string;
  fullTank?: boolean;
  /** Captured with the fill-up; `lib/expenses.ts` turns this into a linked reading. */
  odometer?: number;
};

/** A reading entered by hand rather than captured at a fill-up. */
export type DemoReading = {
  date: Date;
  reading: number;
};

export type DemoDataset = {
  car: typeof DEMO_CAR;
  expenses: DemoExpense[];
  readings: DemoReading[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of fuel fills, spaced across the year. */
const FILL_COUNT = 28;
/** Days between fills — 28 × 13 ≈ 364, so the series spans about twelve months. */
const DAYS_BETWEEN_FILLS = 13;

/** Where the odometer starts. A plausible mid-life figure, not anyone's real car. */
const STARTING_KM = 142_000;

/** Scales a litres-in-tenths pick back to litres. Not a money conversion — see below. */
const TENTHS_PER_LITER = 10;

// The three deliberate irregularities, by fill index. Named rather than
// scattered as magic numbers, because a test asserts each one exists and the
// two definitions must not drift.
/** This fill is a partial top-up, so it cannot close a consumption interval. */
export const PARTIAL_FILL_INDEX = 9;
/** This fill records no odometer reading — a gap in the distance series. */
export const MISSING_READING_INDEX = 16;
/** This reading is lower than its predecessor — a mis-keyed entry, later corrected. */
export const DECREASING_READING_INDEX = 22;

/** Placeholder station names. Deliberately not real businesses. */
const STATIONS = ["Demo Fuel North", "Demo Fuel South", "Sample Services", "Placeholder Petrol"];

/**
 * A tiny linear congruential generator with a fixed seed.
 *
 * Used instead of `Math.random()` so the dataset varies convincingly while
 * staying byte-identical across runs. The constants are the Numerical Recipes
 * ones; the statistical quality is irrelevant here, reproducibility is the
 * entire point.
 */
function sequence(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Picks an integer in [min, max] from the generator. */
function pick(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

/**
 * Midnight UTC on the anchor's day.
 *
 * Normalised for the same reason `lib/aggregation.ts` buckets on UTC: dates
 * enter the database as UTC midnight, and an anchor carrying a local-time
 * component would shift every generated date by a few hours — enough to move a
 * fill into the previous month for anyone west of UTC.
 */
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

function daysBefore(anchor: Date, days: number): Date {
  return new Date(anchor.getTime() - days * DAY_MS);
}

/**
 * Builds the dataset ending on `anchor`.
 *
 * The most recent fill lands on the anchor day itself, so a run with the
 * default anchor of "today" always populates the current month — otherwise the
 * report's newest row would be stale on the day it was seeded.
 */
export function buildDemoData(anchor: Date): DemoDataset {
  const end = startOfUtcDay(anchor);
  const next = sequence(20260809);

  const expenses: DemoExpense[] = [];

  // Walked oldest-first so the odometer can accumulate. `true` distance is
  // tracked separately from what gets recorded, because one entry is
  // deliberately mis-keyed and the series must carry on correctly afterwards.
  let odometer = STARTING_KM;

  for (let index = 0; index < FILL_COUNT; index += 1) {
    const daysAgo = (FILL_COUNT - 1 - index) * DAYS_BETWEEN_FILLS;
    const date = daysBefore(end, daysAgo);

    if (index > 0) odometer += pick(next, 400, 900);

    // Litres are picked in tenths and scaled, so a fill is 41.3 L rather than a
    // suspiciously round 41. The divisor is TENTHS_PER_LITER, deliberately not
    // 100: a `/ 100` here would read as a euro↔cent conversion, and
    // `lib/money.ts` is the only place money may change unit.
    const pricePerLiterCents = pick(next, 165, 192);
    const liters = pick(next, 320, 560) / TENTHS_PER_LITER;
    const amountCents = Math.round(liters * pricePerLiterCents);

    const isPartial = index === PARTIAL_FILL_INDEX;
    const hasReading = index !== MISSING_READING_INDEX;

    // A transposed digit rather than a replaced odometer: the next fill returns
    // to the true series, which is the harder case for a consumption
    // calculation than a permanent reset.
    const recorded = index === DECREASING_READING_INDEX ? odometer - 1_200 : odometer;

    expenses.push({
      categoryName: "Fuel",
      amountCents,
      date,
      liters,
      station: STATIONS[index % STATIONS.length],
      fullTank: !isPartial,
      ...(hasReading ? { odometer: recorded } : {}),
      ...(isPartial ? { notes: "Partial top-up" } : {}),
    });
  }

  // Non-fuel spending, spread across the same year. Fixed offsets rather than
  // generated ones: these are the rows a category breakdown is read from, so
  // they are easier to reason about when they are simply visible.
  const other: Array<[string, number, number, string?]> = [
    ["Insurance", 48_000, 350, "Annual policy"],
    ["Taxes/Fees", 21_500, 340, "Road tax"],
    ["Maintenance", 18_900, 322, "Oil and filter"],
    ["Parking", 1_200, 300],
    ["Tires", 42_000, 286, "Winter set"],
    ["Maintenance", 7_450, 265],
    ["Parking", 900, 244],
    ["Body Work", 26_000, 232, "Door ding"],
    ["Maintenance", 12_300, 210, "Brake pads"],
    ["Parking", 1_500, 188],
    ["Taxes/Fees", 3_400, 166, "Inspection"],
    ["Maintenance", 9_800, 144],
    ["Parking", 1_100, 122],
    ["Tires", 4_500, 100, "Seasonal swap"],
    ["Maintenance", 15_600, 78, "Timing belt check"],
    ["Parking", 800, 56],
    ["Vignette", 9_700, 34, "Annual"],
    ["Maintenance", 6_200, 20],
    ["Parking", 1_300, 6],
  ];

  for (const [categoryName, amountCents, daysAgo, notes] of other) {
    expenses.push({
      categoryName,
      amountCents,
      date: daysBefore(end, daysAgo),
      ...(notes ? { notes } : {}),
    });
  }

  // A few readings noted by hand rather than at a pump — what someone does at a
  // service. They give the odometer series points that are not tied to a fill,
  // which is a shape 03-02 must also cope with.
  const readings: DemoReading[] = [
    { date: daysBefore(end, 322), reading: STARTING_KM + 2_100 },
    { date: daysBefore(end, 210), reading: STARTING_KM + 8_400 },
    { date: daysBefore(end, 78), reading: STARTING_KM + 14_900 },
  ];

  // Sorted oldest-first. The data layer does not care, but a stable order makes
  // the deep-equality determinism test meaningful rather than accidental.
  expenses.sort((a, b) => a.date.getTime() - b.date.getTime());

  return { car: DEMO_CAR, expenses, readings };
}
