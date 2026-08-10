/**
 * Fuel consumption from full-tank to full-tank.
 *
 * ## Why this is a separate module
 *
 * Same split as `lib/aggregation.ts` and `lib/demo-data.ts`: this file imports
 * nothing at all, so `npm test` proves it with no database running. That
 * matters more here than anywhere else in the project, because every failure
 * mode below produces a *plausible number* rather than an error. A consumption
 * figure that is 20% low looks exactly like one that is right.
 *
 * ## The method
 *
 * An interval runs between two full tanks whose odometer is known. The fuel
 * burned over that distance is every litre put into the tank *after* the first
 * full tank, up to and including the second — because the tank started full and
 * ended full, so everything added in between was consumed.
 *
 * Three consequences, each of which is a way to get this wrong:
 *
 * 1. **A partial fill's litres still count.** They went into the tank and were
 *    burned. Dropping them undercounts fuel — on the demo fixture, by about
 *    20%, which reads as a suspiciously efficient car rather than as a bug.
 *
 * 2. **A partial fill is never an interval ENDPOINT, even when it carries an
 *    odometer reading.** This is the subtle one: the reading makes the fill look
 *    perfectly usable. But the tank was not full, so the fuel added does not
 *    correspond to the distance since the last full tank.
 *
 * 3. **A reading that goes backwards invalidates itself, not the series.** When
 *    the next reading is lower than the open interval's start, the interval does
 *    NOT close there and does NOT restart there — it stays open and closes at
 *    the next credible reading, absorbing the litres in between. Odometers get
 *    mis-keyed (a transposed digit) far more often than they get replaced, and
 *    in that case the following fill returns to the true series. Closing at the
 *    bad reading would produce one negative interval and one inflated one, both
 *    of which look like data.
 *
 * ## Units
 *
 * Kilometres, litres, and integer cents. Nothing here divides money by
 * anything — cost per distance is a money conversion and belongs in
 * `lib/money.ts`, which is the only place money may change unit. This module
 * carries `costCents` through untouched so the view can pair it with a distance.
 */

/** One fuel purchase. Declared locally so no Prisma type reaches the maths. */
export type FuelFill = {
  date: Date;
  amountCents: number;
  liters: number;
  fullTank: boolean;
  /** The odometer captured with this fill, if one was recorded. */
  odometer?: number;
};

/** An odometer reading, from a fill-up or entered by hand. */
export type Reading = {
  date: Date;
  reading: number;
};

export type ConsumptionInterval = {
  fromDate: Date;
  toDate: Date;
  fromKm: number;
  toKm: number;
  distanceKm: number;
  liters: number;
  litersPer100Km: number;
  /** Cost of the fills counted in this interval, in cents. Never divided here. */
  costCents: number;
};

export type Consumption = {
  intervals: ConsumptionInterval[];
  /** Litres counted inside intervals — not every litre ever bought. */
  totalLiters: number;
  /** Kilometres covered by intervals. */
  totalDistanceKm: number;
  /** Distance-weighted average, or null when nothing could be measured. */
  averageLitersPer100Km: number | null;
  /** Span of credible readings, for cost-per-km. Null when fewer than two. */
  distanceForCostKm: number | null;
};

const KM_PER_CONSUMPTION_UNIT = 100;

/**
 * A fill can close or open an interval only if the tank was filled AND the
 * odometer was recorded. See consequence (2) in the module note — the reading
 * alone is not enough, and that is the trap.
 */
function isEndpoint(fill: FuelFill): fill is FuelFill & { odometer: number } {
  return fill.fullTank && fill.odometer !== undefined;
}

/**
 * Chronological order, with deterministic tie-breaking.
 *
 * Two fills on one day is ordinary. Without a tiebreak their order would depend
 * on whatever order the query returned, which would make the intervals — and
 * therefore the reported consumption — quietly non-reproducible.
 */
function chronological<T extends { date: Date }>(rows: readonly T[], key: (row: T) => number): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        a.row.date.getTime() - b.row.date.getTime() || key(a.row) - key(b.row) || a.index - b.index,
    )
    .map((entry) => entry.row);
}

/**
 * Keeps only readings that do not go backwards, oldest first.
 *
 * Used for the cost-per-km distance. A raw `min`/`max` over the series would
 * let a single mis-keyed low reading become the start and inflate the distance,
 * which deflates cost per kilometre — again, plausibly.
 *
 * Known limitation, stated rather than hidden: if the very FIRST reading is
 * anomalously high, everything after it is discarded and the span collapses.
 * That is the rarer error, and the alternative (guessing which end is wrong)
 * would be inventing data.
 */
function credibleReadings(readings: readonly Reading[]): number[] {
  const kept: number[] = [];

  for (const { reading } of chronological(readings, (row) => row.reading)) {
    if (kept.length === 0 || reading >= kept[kept.length - 1]) kept.push(reading);
  }

  return kept;
}

/**
 * Builds the consumption picture from a car's fills and readings.
 *
 * Returns empty/null rather than zero when nothing can be measured: a car with
 * one fill-up has *unknown* consumption, which is a different statement from
 * 0.0 L/100km, and only one of those is honest.
 */
export function buildConsumption(
  fills: readonly FuelFill[],
  readings: readonly Reading[],
): Consumption {
  const ordered = chronological(fills, (fill) => fill.odometer ?? Number.POSITIVE_INFINITY);

  const intervals: ConsumptionInterval[] = [];

  // Index of the fill that opened the currently-open interval, or -1 before the
  // first usable endpoint is found.
  let openIndex = -1;
  let pendingLiters = 0;
  let pendingCostCents = 0;

  for (let index = 0; index < ordered.length; index += 1) {
    const fill = ordered[index];

    if (openIndex === -1) {
      // Fills before the first endpoint are discarded entirely. There is no
      // known starting odometer, so the distance their fuel covered is
      // unknowable — counting them against a later interval would inflate it.
      if (isEndpoint(fill)) openIndex = index;
      continue;
    }

    // Every litre after the open endpoint counts, whatever kind of fill it is.
    pendingLiters += fill.liters;
    pendingCostCents += fill.amountCents;

    if (!isEndpoint(fill)) continue;

    const start = ordered[openIndex] as FuelFill & { odometer: number };
    const distanceKm = fill.odometer - start.odometer;

    if (distanceKm <= 0) {
      // Not credible. Leave the interval open and keep accumulating: the next
      // fill very likely returns to the true series. See consequence (3).
      continue;
    }

    intervals.push({
      fromDate: start.date,
      toDate: fill.date,
      fromKm: start.odometer,
      toKm: fill.odometer,
      distanceKm,
      liters: pendingLiters,
      litersPer100Km: (pendingLiters * KM_PER_CONSUMPTION_UNIT) / distanceKm,
      costCents: pendingCostCents,
    });

    openIndex = index;
    pendingLiters = 0;
    pendingCostCents = 0;
  }

  const totalLiters = intervals.reduce((sum, interval) => sum + interval.liters, 0);
  const totalDistanceKm = intervals.reduce((sum, interval) => sum + interval.distanceKm, 0);

  // Weighted by distance, deliberately: the mean of the per-interval rates
  // would weight a 40 km interval the same as a 900 km one, which is simply a
  // different — and wrong — number.
  const averageLitersPer100Km =
    totalDistanceKm > 0 ? (totalLiters * KM_PER_CONSUMPTION_UNIT) / totalDistanceKm : null;

  const credible = credibleReadings(readings);
  const distanceForCostKm =
    credible.length >= 2 ? credible[credible.length - 1] - credible[0] : null;

  return {
    intervals,
    totalLiters,
    totalDistanceKm,
    averageLitersPer100Km,
    distanceForCostKm: distanceForCostKm && distanceForCostKm > 0 ? distanceForCostKm : null,
  };
}
