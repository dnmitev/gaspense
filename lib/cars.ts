import { prisma } from "@/lib/prisma";
import type { CarInput } from "@/lib/validation/car";

/**
 * Scoped data access for cars.
 *
 * ## Why every function takes `userId` explicitly
 *
 * None of these read the session themselves. That is deliberate:
 *
 * - The scoping is **visible at the call site**, so a reviewer can see that a
 *   caller passed the right id — rather than trusting a filter buried inside.
 * - These stay unit-testable without mocking auth.
 *
 * Isolation is enforced here and nowhere else: this project uses NextAuth, not
 * Supabase Auth, so there is no Postgres RLS underneath. A query that loses its
 * `userId` filter returns every user's rows. `tests/integration/cars.test.ts`
 * asserts each function refuses across users.
 *
 * Callers get `userId` from `requireUserId()` in `lib/session.ts`, which throws
 * rather than returning null — never pass a nullable value in here.
 */

/** Cars the user can currently see. Excludes soft-deleted rows. */
export function listActiveCars(userId: string) {
  return prisma.car.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/** A single car, or null if it does not exist, is deleted, or belongs to someone else. */
export function getCarById(userId: string, carId: string) {
  return prisma.car.findFirst({
    where: { id: carId, userId, deletedAt: null },
  });
}

export function createCar(userId: string, input: CarInput) {
  return prisma.car.create({
    data: { ...input, userId },
  });
}

/**
 * Scoped update.
 *
 * Uses `updateMany` rather than `findFirst`-then-`update`: the `userId` sits in
 * the same WHERE clause as the id, so a mismatched owner updates zero rows in a
 * single statement. The find-then-update shape is where cross-user writes leak
 * in, because the second call addresses the row by id alone.
 *
 * Returns the number of rows affected — 0 means "not yours, or not found".
 */
export async function updateCar(userId: string, carId: string, input: CarInput): Promise<number> {
  const result = await prisma.car.updateMany({
    where: { id: carId, userId, deletedAt: null },
    data: input,
  });

  return result.count;
}

/**
 * Soft delete: sets `deletedAt` so the car leaves the user's list while its
 * expense history survives. Scoped the same way as {@link updateCar}.
 *
 * Returns the number of rows affected — 0 means "not yours, or already gone".
 */
export async function softDeleteCar(userId: string, carId: string): Promise<number> {
  const result = await prisma.car.updateMany({
    where: { id: carId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return result.count;
}
