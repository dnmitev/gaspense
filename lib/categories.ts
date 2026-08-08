import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CategoryInput } from "@/lib/validation/category";

/**
 * Scoped data access for categories.
 *
 * ## Two sets of rows, one table
 *
 * `Category.userId` is nullable. `null` means a **system default** — one of the
 * ten seeded rows every user can file expenses under. A non-null `userId` means
 * a category that one user owns.
 *
 * Reads span both sets. **Writes never do.** Every write filters
 * `where: { id, userId }` with a real user id, which cannot match a row whose
 * `userId` is NULL — so a system category is unreachable by the ordinary code
 * path. There is deliberately no `if (category.userId === null) reject` guard:
 * the scoping already covers it, and a special case would imply the general
 * rule needs supervision.
 *
 * ## Errors the database raises that the type system cannot
 *
 * Two constraints here are invisible to Prisma's types:
 *
 * - The partial unique indexes from 02-03 are raw SQL, so a duplicate name
 *   surfaces only as **P2002** at write time.
 * - `Expense.category` is `onDelete: Restrict`, so deleting a category still in
 *   use surfaces as **P2003**.
 *
 * Both are ordinary user actions — adding "Fuel" twice, deleting a category you
 * forgot you used. Neither may reach the user as an unhandled error, so these
 * functions return a described result instead of throwing.
 */

/** Matches the caller's own categories plus the shared system defaults. */
const visibleCategory = (userId: string) => ({ OR: [{ userId }, { userId: null }] });

function isKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * A duplicate name. Checked by `error.code` rather than by inspecting
 * `error.meta.target`: the constraint here is a raw-SQL partial index, so the
 * reported target is an index name rather than the field list callers expect.
 */
const isDuplicateName = (error: unknown) => isKnownError(error, "P2002");

/** A row still referenced by an expense (`onDelete: Restrict`). */
const isStillReferenced = (error: unknown) => isKnownError(error, "P2003");

export type CategoryWriteResult =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "duplicate-name" }
  | { ok: false; reason: "in-use"; expenseCount: number };

/**
 * Every category the caller may file an expense under: their own, plus the
 * seeded system rows.
 *
 * Moved here from `lib/expenses.ts` in 02-07 — it was living there only because
 * the expense form was its first consumer.
 */
export function listVisibleCategories(userId: string) {
  return prisma.category.findMany({
    where: visibleCategory(userId),
    orderBy: { name: "asc" },
  });
}

/** Only the categories the caller owns — the manageable set. */
export function listOwnCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

/** The system defaults, shown read-only so their absence from the editable list is explicable. */
export function listSystemCategories() {
  return prisma.category.findMany({
    where: { userId: null },
    orderBy: { name: "asc" },
  });
}

/** Creates a category owned by the caller. `userId` is always set, never null. */
export async function createCategory(
  userId: string,
  input: CategoryInput,
): Promise<CategoryWriteResult> {
  try {
    await prisma.category.create({ data: { name: input.name, userId } });
    return { ok: true };
  } catch (error) {
    if (isDuplicateName(error)) return { ok: false, reason: "duplicate-name" };
    throw error;
  }
}

/**
 * Renames one of the caller's own categories.
 *
 * `updateMany` with `{ id, userId }`: a system row has `userId: null` and can
 * never match, so zero rows change and the caller is told "not found".
 */
export async function renameCategory(
  userId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<CategoryWriteResult> {
  try {
    const result = await prisma.category.updateMany({
      where: { id: categoryId, userId },
      data: { name: input.name },
    });

    return result.count === 0 ? { ok: false, reason: "not-found" } : { ok: true };
  } catch (error) {
    if (isDuplicateName(error)) return { ok: false, reason: "duplicate-name" };
    throw error;
  }
}

/**
 * Deletes one of the caller's own categories, unless an expense still uses it.
 *
 * The count is taken first so the refusal can say *how many* expenses are
 * affected — "in use" alone leaves the user to guess. The P2003 catch is a
 * backstop rather than duplication: the count and the delete are two
 * statements, so an expense can be filed in between.
 *
 * Reassigning those expenses to another category is deliberately not offered
 * here. Silently moving someone's records while they asked to delete a label is
 * a bigger action than the one they requested.
 */
export async function deleteCategory(
  userId: string,
  categoryId: string,
): Promise<CategoryWriteResult> {
  const owned = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!owned) return { ok: false, reason: "not-found" };

  const expenseCount = await prisma.expense.count({ where: { categoryId } });
  if (expenseCount > 0) return { ok: false, reason: "in-use", expenseCount };

  try {
    const result = await prisma.category.deleteMany({ where: { id: categoryId, userId } });
    return result.count === 0 ? { ok: false, reason: "not-found" } : { ok: true };
  } catch (error) {
    if (isStillReferenced(error)) {
      return {
        ok: false,
        reason: "in-use",
        expenseCount: await prisma.expense.count({ where: { categoryId } }),
      };
    }
    throw error;
  }
}
