import { prisma } from "@/lib/prisma";
import type { OdometerInput } from "@/lib/validation/odometer";

/**
 * Scoped data access for odometer readings.
 *
 * Same shape as `lib/expenses.ts`, and for the same reason: `OdometerReading`
 * has **no `userId` column**, so every filter reaches through
 * `car: { userId, deletedAt: null }`. A dropped relation filter here is not a
 * type error — it is a query that quietly returns every user's readings.
 *
 * Readings arrive from two places: entered by hand (`source: MANUAL`) and
 * captured alongside a fill-up (`source: EXPENSE`, with `expenseId` set). The
 * functions here own the manual ones; `lib/expenses.ts` owns the linked ones,
 * because their lifetime is tied to the expense rather than to this module.
 */

/** Matches a live car belonging to the caller. */
const ownedCar = (userId: string) => ({ userId, deletedAt: null });

/**
 * Readings for one of the caller's live cars, newest first.
 *
 * Ties break on `reading` descending: two entries on the same day are most
 * likely a correction, and showing the higher one first matches how a user
 * reads a mileage log.
 */
export function listReadingsForCar(userId: string, carId: string) {
  return prisma.odometerReading.findMany({
    where: { carId, car: ownedCar(userId) },
    orderBy: [{ date: "desc" }, { reading: "desc" }],
  });
}

/** A single reading, or null if it is not the caller's. */
export function getReadingById(userId: string, readingId: string) {
  return prisma.odometerReading.findFirst({
    where: { id: readingId, car: ownedCar(userId) },
  });
}

/**
 * Creates a manual reading, or returns null when the car is not the caller's.
 *
 * `create` has no WHERE clause, so ownership is an explicit pre-check here
 * rather than a filter — the same single weak point as `createExpense`.
 */
export async function createReading(userId: string, input: OdometerInput) {
  const car = await prisma.car.findFirst({
    where: { id: input.carId, ...ownedCar(userId) },
    select: { id: true },
  });

  if (!car) return null;

  return prisma.odometerReading.create({
    data: { ...input, source: "MANUAL" },
  });
}

/**
 * Scoped update. Returns the number of rows affected — 0 means "not yours, or
 * not found".
 *
 * `source` is not updatable: a reading captured from a fill-up must not be able
 * to disguise itself as a manual entry, or the link back to its expense becomes
 * unexplainable to anyone reading the log.
 */
export async function updateReading(
  userId: string,
  readingId: string,
  input: OdometerInput,
): Promise<number> {
  const car = await prisma.car.findFirst({
    where: { id: input.carId, ...ownedCar(userId) },
    select: { id: true },
  });

  if (!car) return 0;

  const result = await prisma.odometerReading.updateMany({
    where: { id: readingId, car: ownedCar(userId) },
    data: { carId: input.carId, date: input.date, reading: input.reading },
  });

  return result.count;
}

/** Scoped hard delete. Returns the number of rows affected. */
export async function deleteReading(userId: string, readingId: string): Promise<number> {
  const result = await prisma.odometerReading.deleteMany({
    where: { id: readingId, car: ownedCar(userId) },
  });

  return result.count;
}
