import { prisma } from "@/lib/prisma";
import type { ExpenseInput } from "@/lib/validation/expense";

/**
 * Scoped data access for expenses.
 *
 * ## Why this looks different from `lib/cars.ts`
 *
 * `Expense` has **no `userId` column**. Its only link to an owner is
 * `Expense.carId → Car.userId`, so every filter here goes through the `car`
 * relation rather than a column of its own. Relation filters are available to
 * `updateMany`/`deleteMany` — `ExpenseWhereInput` exposes `car`, verified
 * against the generated Prisma 7 types — so 02-05's scoped-write pattern
 * survives unchanged in shape.
 *
 * Filtering `car.deletedAt: null` as well is what makes a soft-deleted car's
 * expenses unreachable while their rows survive for history.
 *
 * The same rules as `lib/cars.ts` apply: every function takes `userId`
 * explicitly, none reads the session, and isolation is enforced here and
 * nowhere else — this project has no Postgres RLS backstop.
 */

/** Matches a live car belonging to the caller. The scope filter, in one place. */
const ownedCar = (userId: string) => ({ userId, deletedAt: null });

/** Matches the caller's own categories plus the shared system defaults. */
const visibleCategory = (userId: string) => ({ OR: [{ userId }, { userId: null }] });

/** Expenses on one of the caller's live cars, newest first. */
export function listExpensesForCar(userId: string, carId: string) {
  return prisma.expense.findMany({
    where: { carId, car: ownedCar(userId) },
    include: { category: true },
    // createdAt breaks ties so two expenses on the same day keep a stable order.
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * A single expense, or null if it does not exist or is not the caller's.
 *
 * Includes the linked odometer reading so an edit form can seed the field
 * without a second query — and so the absence of one is visible rather than
 * inferred.
 */
export function getExpenseById(userId: string, expenseId: string) {
  return prisma.expense.findFirst({
    where: { id: expenseId, car: ownedCar(userId) },
    include: { odometerReading: true },
  });
}

/**
 * Confirms the caller may write an expense against this car and category.
 *
 * **This is the one place in the codebase where scoping is a check rather than
 * a filter**, and therefore the one place it can be forgotten. `create` has no
 * WHERE clause, so without this a forged `carId` in a form post would attach an
 * expense to a stranger's car — the row would be perfectly valid and invisible
 * to its actual owner's list only by luck.
 *
 * The category is checked too: filing under someone else's private category
 * would leak its name straight back out through the expense list.
 */
async function mayWrite(userId: string, carId: string, categoryId: string): Promise<boolean> {
  const [car, category] = await Promise.all([
    prisma.car.findFirst({
      where: { id: carId, ...ownedCar(userId) },
      select: { id: true },
    }),
    prisma.category.findFirst({
      where: { id: categoryId, ...visibleCategory(userId) },
      select: { id: true },
    }),
  ]);

  return car !== null && category !== null;
}

/**
 * Creates an expense, or returns null when the car or category is not the
 * caller's to use.
 *
 * Null rather than a thrown error, and the same null for both causes: the
 * caller reports "not found" without revealing which of the two ids was the
 * problem, since confirming one exists is itself a leak.
 */
export async function createExpense(userId: string, input: ExpenseInput) {
  if (!(await mayWrite(userId, input.carId, input.categoryId))) return null;

  const { odometer, ...expense } = input;

  // One transaction: an expense must never be saved with its reading half
  // written, or the consumption series gains a fill-up with no distance.
  return prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({ data: expense });

    if (odometer !== undefined) {
      await tx.odometerReading.create({
        data: {
          carId: created.carId,
          date: created.date,
          reading: odometer,
          source: "EXPENSE",
          expenseId: created.id,
        },
      });
    }

    return created;
  });
}

/**
 * Scoped update. Returns the number of rows affected — 0 means "not yours, or
 * not found".
 *
 * Two gates, and both are needed: {@link mayWrite} covers the *incoming* car and
 * category (so an expense cannot be moved onto a stranger's car), while the
 * `where` covers the *existing* row (so a stranger's expense cannot be edited).
 * Checking only one of those leaves the other direction open.
 */
export async function updateExpense(
  userId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<number> {
  if (!(await mayWrite(userId, input.carId, input.categoryId))) return 0;

  const { odometer, ...expense } = input;

  return prisma.$transaction(async (tx) => {
    const result = await tx.expense.updateMany({
      where: { id: expenseId, car: ownedCar(userId) },
      data: expense,
    });

    // Nothing matched: not the caller's expense. Touch no reading either.
    if (result.count === 0) return 0;

    const existing = await tx.odometerReading.findUnique({ where: { expenseId } });

    if (odometer === undefined) {
      // Cleared. The reading only ever existed as part of this expense, so it
      // goes with it rather than lingering as an unexplained manual entry.
      if (existing) await tx.odometerReading.delete({ where: { expenseId } });
    } else if (existing) {
      // `carId` and `date` are carried across too: a reading left on the old
      // date would show the fill-up happening on a day it did not.
      await tx.odometerReading.update({
        where: { expenseId },
        data: { carId: expense.carId, date: expense.date, reading: odometer },
      });
    } else {
      await tx.odometerReading.create({
        data: {
          carId: expense.carId,
          date: expense.date,
          reading: odometer,
          source: "EXPENSE",
          expenseId,
        },
      });
    }

    return result.count;
  });
}

/**
 * Scoped hard delete. Returns the number of rows affected.
 *
 * Hard, not soft: cars soft-delete so their history survives, but an expense
 * *is* the history — a deleted one is a correction, not something to preserve.
 *
 * Any linked odometer reading goes with it, by the `ON DELETE CASCADE` on
 * `OdometerReading.expenseId`. That is a database guarantee rather than code
 * here, so the integration suite asserts it actually happens.
 */
export async function deleteExpense(userId: string, expenseId: string): Promise<number> {
  const result = await prisma.expense.deleteMany({
    where: { id: expenseId, car: ownedCar(userId) },
  });

  return result.count;
}
