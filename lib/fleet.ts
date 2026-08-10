import { byMonth, type ExpenseRow, type PeriodTotal, totalCents } from "@/lib/aggregation";
import { listActiveCars } from "@/lib/cars";
import { buildConsumption, type FuelFill, type Reading } from "@/lib/consumption";
import { prisma } from "@/lib/prisma";

/**
 * The all-cars roll-up behind the dashboard.
 *
 * ## Why the isolation reasoning here is not the reasoning elsewhere
 *
 * `getCarReport` and `getCarEfficiency` are scoped by a single `carId`, and
 * mutation testing showed their `getCarById` pre-check was what actually
 * refused a stranger — the relation filter turned out to be redundant, because
 * `carId` already identifies exactly one car that the pre-check had proven was
 * the caller's.
 *
 * **None of that transfers here.** There is no single car to pre-check, so the
 * scoping IS the protection: this is the first query in the project where a
 * missing filter would return every user's spending rather than one stranger's.
 *
 * Ownership is therefore resolved explicitly first — `listActiveCars` is
 * already scoped and already tested — and the resulting id set is used
 * alongside the relation filter. Which of the two is load-bearing was measured
 * rather than assumed; see the note on {@link getFleetSummary}.
 *
 * ## Composition, not reimplementation
 *
 * The monthly buckets come from `lib/aggregation.ts` and the consumption from
 * `lib/consumption.ts`, both already exhaustively unit-tested. A second
 * implementation of either — easy to reach for, since the shapes are slightly
 * different here — is the specific mistake this module exists to avoid.
 */

/** Matches a live car belonging to the caller. */
const ownedCar = (userId: string) => ({ userId, deletedAt: null });

export type FleetCar = {
  id: string;
  licensePlate: string;
  nickname: string | null;
  totalCents: number;
  /** Null when the car has too few usable fill-ups to measure. Never 0. */
  averageLitersPer100Km: number | null;
};

export type FleetSummary = {
  totalCents: number;
  byMonth: PeriodTotal[];
  cars: FleetCar[];
};

const EMPTY: FleetSummary = { totalCents: 0, byMonth: [], cars: [] };

/**
 * What every one of the caller's live cars has cost, together and separately.
 *
 * ## Mutation results, measured 2026-08-10
 *
 * Each scoping mechanism was removed independently, rather than reasoning about
 * which one mattered:
 *
 * - Removing `carId: { in: ownedCarIds }`, keeping the relation filter —
 *   **9/9 tests still pass.**
 * - Removing `car: ownedCar(userId)`, keeping the id set — **9/9 still pass**,
 *   because the id set was itself derived from `listActiveCars(userId)`.
 * - Removing **both** — 2 tests fail: the cross-user case (Alice's dashboard
 *   totals Bob's €999) and the soft-delete case (a deleted car reappears).
 *
 * So unlike `getCarReport` — where the pre-check did all the work and the filter
 * did none — here the two are genuinely redundant with each other and either
 * alone suffices. Both are kept anyway. They cost nothing, and the failure mode
 * if a later reader deletes "the redundant one" without checking which is which
 * is every user's spending totalled onto one dashboard.
 */
export async function getFleetSummary(userId: string): Promise<FleetSummary> {
  const cars = await listActiveCars(userId);

  // Short-circuit rather than issuing three queries whose `{ in: [] }` can only
  // return nothing.
  if (cars.length === 0) return EMPTY;

  const ownedCarIds = cars.map((car) => car.id);
  const scope = { carId: { in: ownedCarIds }, car: ownedCar(userId) };

  const [expenses, fills, readings] = await Promise.all([
    prisma.expense.findMany({
      where: scope,
      select: {
        carId: true,
        date: true,
        amountCents: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    // Fuel purchases are identified by carrying litres, not by category name —
    // names are user data and can be renamed, litres cannot.
    prisma.expense.findMany({
      where: { ...scope, liters: { not: null } },
      select: {
        carId: true,
        date: true,
        amountCents: true,
        liters: true,
        fullTank: true,
        odometerReading: { select: { reading: true } },
      },
    }),
    prisma.odometerReading.findMany({
      where: scope,
      select: { carId: true, date: true, reading: true },
    }),
  ]);

  const rows: ExpenseRow[] = expenses.map((expense) => ({
    date: expense.date,
    amountCents: expense.amountCents,
    categoryId: expense.categoryId,
    categoryName: expense.category.name,
  }));

  // Grouped once into maps rather than filtered per car inside the loop, which
  // would be quadratic in the number of expenses.
  const totalsByCar = new Map<string, number>();
  for (const expense of expenses) {
    totalsByCar.set(expense.carId, (totalsByCar.get(expense.carId) ?? 0) + expense.amountCents);
  }

  const fillsByCar = new Map<string, FuelFill[]>();
  for (const fill of fills) {
    const list = fillsByCar.get(fill.carId) ?? [];
    list.push({
      date: fill.date,
      amountCents: fill.amountCents,
      liters: fill.liters as number,
      fullTank: fill.fullTank ?? false,
      ...(fill.odometerReading === null ? {} : { odometer: fill.odometerReading.reading }),
    });
    fillsByCar.set(fill.carId, list);
  }

  const readingsByCar = new Map<string, Reading[]>();
  for (const reading of readings) {
    const list = readingsByCar.get(reading.carId) ?? [];
    list.push({ date: reading.date, reading: reading.reading });
    readingsByCar.set(reading.carId, list);
  }

  return {
    totalCents: totalCents(rows),
    byMonth: byMonth(rows),
    cars: cars.map((car) => ({
      id: car.id,
      licensePlate: car.licensePlate,
      nickname: car.nickname,
      totalCents: totalsByCar.get(car.id) ?? 0,
      averageLitersPer100Km: buildConsumption(
        fillsByCar.get(car.id) ?? [],
        readingsByCar.get(car.id) ?? [],
      ).averageLitersPer100Km,
    })),
  };
}
