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

/** A single expense, or null if it does not exist or is not the caller's. */
export function getExpenseById(userId: string, expenseId: string) {
  return prisma.expense.findFirst({
    where: { id: expenseId, car: ownedCar(userId) },
  });
}

/**
 * Categories the caller may file an expense under: their own, plus the seeded
 * system rows (`userId: null`) that everyone shares.
 *
 * Read-only by design. Category writes are 02-07's, and must never be able to
 * reach a system row — editing one would change it for every user.
 */
export function listVisibleCategories(userId: string) {
  return prisma.category.findMany({
    where: visibleCategory(userId),
    orderBy: { name: "asc" },
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

  return prisma.expense.create({ data: input });
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

  const result = await prisma.expense.updateMany({
    where: { id: expenseId, car: ownedCar(userId) },
    data: input,
  });

  return result.count;
}

/**
 * Scoped hard delete. Returns the number of rows affected.
 *
 * Hard, not soft: cars soft-delete so their history survives, but an expense
 * *is* the history — a deleted one is a correction, not something to preserve.
 */
export async function deleteExpense(userId: string, expenseId: string): Promise<number> {
  const result = await prisma.expense.deleteMany({
    where: { id: expenseId, car: ownedCar(userId) },
  });

  return result.count;
}
