import {
  byCategory,
  byMonth,
  byYear,
  totalCents,
  type CategoryTotal,
  type ExpenseRow,
  type PeriodTotal,
} from "@/lib/aggregation";
import { getCarById } from "@/lib/cars";
import { buildConsumption, type Consumption, type FuelFill, type Reading } from "@/lib/consumption";
import { prisma } from "@/lib/prisma";

/**
 * Scoped data access for reports.
 *
 * Same shape as `lib/expenses.ts`, and for the same reason: `Expense` has no
 * `userId` column, so every filter reaches through `car: { userId, deletedAt:
 * null }`. A dropped relation filter here is not a type error — it is a query
 * that quietly totals every user's spending into one number.
 *
 * `userId` is taken explicitly and the session is never read here, matching
 * every other module in `lib/`.
 *
 * ## Why the arithmetic is not in SQL
 *
 * A `GROUP BY date_trunc('month', ...)` would push the month bucketing into a
 * raw query, and the UTC rule it depends on is the single thing here most
 * likely to be got wrong (see `lib/aggregation.ts`). Keeping it in TypeScript
 * keeps it unit-testable with no database running. Personal-scale data is a few
 * hundred rows per car, so the cost is nil; if a car ever holds enough rows for
 * that to stop being true, the fix is a `groupBy` behind this same signature.
 */

/** Matches a live car belonging to the caller. The scope filter, in one place. */
const ownedCar = (userId: string) => ({ userId, deletedAt: null });

export type CarReport = {
  totalCents: number;
  byYear: PeriodTotal[];
  byMonth: PeriodTotal[];
  byCategory: CategoryTotal[];
};

/**
 * The consumption picture plus the two cost totals the view divides by
 * distance. The division itself happens in `lib/money.ts` — these are carried
 * as plain cents so nothing upstream of the formatter turns money into a rate.
 */
export type CarEfficiency = Consumption & {
  fuelCostCents: number;
  totalCostCents: number;
};

/**
 * Everything the report page needs for one car, or `null` when that car is not
 * the caller's live car.
 *
 * ## Why ownership is a separate query rather than an empty result
 *
 * The expense query below is scoped, so a stranger's car already yields no
 * rows. But "no rows" is ambiguous: it is equally what a car of the caller's
 * own with nothing logged yet returns. Collapsing those two would mean a brand
 * new car rendered as "not found", which AC-8 exists to prevent — so ownership
 * is resolved first, by the already-scoped {@link getCarById}.
 *
 * That is a read, so the explicit pre-check reasoning in `createExpense` does
 * not apply here: this is about telling "not yours" apart from "nothing logged
 * yet", not about guarding a write that has no WHERE clause.
 *
 * **The pre-check is also what enforces isolation, not the relation filter
 * below.** Verified by mutation: removing this pre-check fails three tests,
 * while removing `car: ownedCar(userId)` from the query fails none — `carId`
 * already identifies exactly one car, which the pre-check has already proven is
 * the caller's. The filter is kept as defence in depth and for consistency with
 * `lib/expenses.ts`, but do not delete these two lines on the assumption that
 * it covers them: the result would be a stranger's car reporting €0.00 instead
 * of not-found, which is a leak of existence rather than a visible error.
 */
export async function getCarReport(userId: string, carId: string): Promise<CarReport | null> {
  const car = await getCarById(userId, carId);
  if (!car) return null;

  const expenses = await prisma.expense.findMany({
    // Scoped twice over: by the car id, and by that car belonging to the
    // caller. The pre-check above is what actually refuses a stranger — see the
    // mutation note — and this filter is the defence-in-depth layer behind it.
    where: { carId, car: ownedCar(userId) },
    select: {
      date: true,
      amountCents: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  // Flattened to the plain shape `lib/aggregation.ts` accepts, so the
  // calculation never sees a Prisma type and stays reachable from unit tests.
  const rows: ExpenseRow[] = expenses.map((expense) => ({
    date: expense.date,
    amountCents: expense.amountCents,
    categoryId: expense.categoryId,
    categoryName: expense.category.name,
  }));

  return {
    totalCents: totalCents(rows),
    byYear: byYear(rows),
    byMonth: byMonth(rows),
    byCategory: byCategory(rows),
  };
}

/**
 * Everything the efficiency section needs for one car, or `null` when that car
 * is not the caller's live car.
 *
 * ## Ownership is re-checked here, deliberately
 *
 * This repeats {@link getCarReport}'s `getCarById` pre-check rather than leaning
 * on the relation filters below, for the reason 03-01 established by mutation:
 * the filter alone does not *refuse* a stranger's car, it returns an empty
 * result. Here that would render as "not enough data to show consumption" —
 * which quietly confirms the car exists. A 404 is the honest answer.
 */
export async function getCarEfficiency(
  userId: string,
  carId: string,
): Promise<CarEfficiency | null> {
  const car = await getCarById(userId, carId);
  if (!car) return null;

  const [fuelExpenses, readingRows, totals] = await Promise.all([
    // Fuel purchases are identified by carrying litres, not by their category
    // name. Category names are user data — someone may rename "Fuel" or file a
    // fill under a category of their own — but a row with litres on it is a
    // fill-up by construction.
    prisma.expense.findMany({
      where: { carId, car: ownedCar(userId), liters: { not: null } },
      select: {
        date: true,
        amountCents: true,
        liters: true,
        fullTank: true,
        odometerReading: { select: { reading: true } },
      },
    }),
    // Every reading, including MANUAL ones. They are real data points for the
    // distance span even though they can never be interval endpoints.
    prisma.odometerReading.findMany({
      where: { carId, car: ownedCar(userId) },
      select: { date: true, reading: true },
    }),
    prisma.expense.groupBy({
      by: ["carId"],
      where: { carId, car: ownedCar(userId) },
      _sum: { amountCents: true },
    }),
  ]);

  // Flattened to the plain shapes `lib/consumption.ts` accepts, so the maths
  // never sees a Prisma type and stays reachable from unit tests.
  const fills: FuelFill[] = fuelExpenses.map((expense) => ({
    date: expense.date,
    amountCents: expense.amountCents,
    liters: expense.liters as number,
    fullTank: expense.fullTank ?? false,
    ...(expense.odometerReading === null ? {} : { odometer: expense.odometerReading.reading }),
  }));

  const readings: Reading[] = readingRows.map((row) => ({
    date: row.date,
    reading: row.reading,
  }));

  const fuelCostCents = fuelExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const totalCostCents = totals[0]?._sum.amountCents ?? 0;

  return {
    ...buildConsumption(fills, readings),
    fuelCostCents,
    totalCostCents,
  };
}
