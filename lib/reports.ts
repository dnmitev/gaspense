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
    // caller. The relation filter is what does the real work — `carId` alone
    // would happily total a stranger's car.
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
