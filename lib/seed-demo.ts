import { createCar } from "@/lib/cars";
import { buildDemoData, DEMO_PLATE } from "@/lib/demo-data";
import { createExpense } from "@/lib/expenses";
import { createReading } from "@/lib/odometer";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { seedDefaultCategories } from "@/lib/seed-categories";

/**
 * Attaches the demo dataset to a user's account, and removes it again.
 *
 * ## Why this takes no Prisma client, unlike `lib/seed-categories.ts`
 *
 * That module accepts an injected client so a script and a test can each pass
 * their own. This one cannot: it writes through `createCar`, `createExpense`
 * and `createReading`, which are bound to the `lib/prisma.ts` singleton. Taking
 * a client for the lookups while the writes went through the singleton would
 * let the two halves address **different databases** — a failure far worse than
 * the small inconsistency of not matching the other seed module.
 *
 * ## Why it writes through the data layer rather than `createMany`
 *
 * Slower — roughly fifty round trips instead of two — and worth it. The
 * odometer↔expense pairing (`expenseId`, `source: EXPENSE`, matching dates, all
 * inside one transaction) is owned by `createExpense`. Duplicating it here
 * would be a second copy of subtle logic that must not drift, and the seed
 * would be able to create states the application itself never produces. As a
 * side effect the seed exercises the real write path, so a regression there
 * breaks this loudly.
 */

export type SeedResult = {
  userId: string;
  carId: string;
  expenses: number;
  readings: number;
  /** True when an existing demo car was replaced rather than created fresh. */
  replaced: boolean;
};

export type ClearResult = {
  userId: string;
  /** Number of demo cars removed — 0 when there was nothing to remove. */
  removed: number;
};

/**
 * Resolves the account to seed.
 *
 * **Never creates the user.** Seeding a `User` row before the person has signed
 * in breaks their login outright: with `@auth/prisma-adapter`, Google OAuth
 * against an existing user that has no linked `Account` row is refused with
 * `OAuthAccountNotLinked`. Attaching after first sign-in keeps this command
 * entirely out of the authentication path.
 */
async function requireUser(email: string): Promise<{ id: string }> {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true },
  });

  if (!user) {
    throw new Error(
      `No account found for ${normalised}. Sign in with Google once first — this command ` +
        `attaches demo data to an existing account and deliberately never creates one.`,
    );
  }

  return user;
}

/**
 * Removes the demo car for one user.
 *
 * ## Why this hard-deletes, when cars normally soft-delete
 *
 * The soft-delete rule exists so that deleting a car never destroys the expense
 * history behind it. Undoing a seed is not that: this data was generated a
 * moment ago and means nothing. A soft delete would leave every re-seed's
 * corpse in the database forever, invisible in the UI and still counted by any
 * query that forgot its `deletedAt` filter.
 *
 * The `userId` in the same WHERE clause as the plate is what keeps this safe.
 * Matching on the plate alone would delete an identically-plated car belonging
 * to someone else, and this is a destructive path — the integration suite
 * asserts a second user's car survives.
 */
async function removeDemoCars(userId: string): Promise<number> {
  // ⚠️ This is the project's ONLY hard delete of a car, which makes it the only
  // path where `Attachment`'s cascade fires on a car. The cascade removes the
  // rows and the app never learns their storage keys, so every stored object
  // would be orphaned invisibly — the same trap `deleteExpense` has, reached by
  // a different route. Read the keys first, delete the objects after.
  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [
        { car: { userId, licensePlate: DEMO_PLATE } },
        { expense: { car: { userId, licensePlate: DEMO_PLATE } } },
      ],
    },
    select: { storageKey: true },
  });

  const result = await prisma.car.deleteMany({
    where: { userId, licensePlate: DEMO_PLATE },
  });

  if (result.count > 0) {
    const storage = getStorage();
    await Promise.all(attachments.map((attachment) => storage.delete(attachment.storageKey)));
  }

  return result.count;
}

/**
 * Builds the demo dataset and writes it to `email`'s account, replacing any
 * demo car already there.
 *
 * Replacement is silent and unconditional by design: the common case is
 * re-seeding after the integration suite has truncated everything, where there
 * is nothing to replace and a confirmation flag would be pure friction.
 */
export async function seedDemoData({
  email,
  anchor,
}: {
  email: string;
  anchor: Date;
}): Promise<SeedResult> {
  const user = await requireUser(email);

  // On a freshly truncated database the system categories are gone, and
  // `createExpense` refuses a category it cannot see. Without this the seed
  // would fail with a message about ownership rather than about the missing
  // rows — and truncation is exactly the situation this command exists for.
  await seedDefaultCategories(prisma);

  const removed = await removeDemoCars(user.id);

  const dataset = buildDemoData(anchor);

  const car = await createCar(user.id, { ...dataset.car });

  // Resolved from the SYSTEM rows only. Every name in the dataset is a seeded
  // default, and matching a user's own identically-named category would file
  // demo spending under a real label.
  const categories = await prisma.category.findMany({
    where: { userId: null },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));

  for (const expense of dataset.expenses) {
    const categoryId = categoryIdByName.get(expense.categoryName);

    if (!categoryId) {
      throw new Error(
        `Demo dataset references category "${expense.categoryName}", which is not a seeded ` +
          `default. Add it to DEFAULT_CATEGORIES or correct the dataset.`,
      );
    }

    const created = await createExpense(user.id, {
      carId: car.id,
      categoryId,
      amountCents: expense.amountCents,
      date: expense.date,
      notes: expense.notes,
      liters: expense.liters,
      station: expense.station,
      fullTank: expense.fullTank ?? false,
      odometer: expense.odometer,
    });

    // createExpense returns null when the car or category is not usable. A seed
    // that silently wrote fewer rows than it reported would be worse than one
    // that stopped.
    if (created === null) {
      throw new Error(
        `Failed to create a demo expense on ${expense.date.toISOString()} — the car or category ` +
          `was rejected. This should be impossible here and means the seed is out of step with ` +
          `lib/expenses.ts.`,
      );
    }
  }

  for (const reading of dataset.readings) {
    const created = await createReading(user.id, {
      carId: car.id,
      date: reading.date,
      reading: reading.reading,
    });

    if (created === null) {
      throw new Error(`Failed to create a demo odometer reading on ${reading.date.toISOString()}.`);
    }
  }

  return {
    userId: user.id,
    carId: car.id,
    expenses: dataset.expenses.length,
    readings: dataset.readings.length,
    replaced: removed > 0,
  };
}

/** Removes the demo car and everything hanging off it, for one account. */
export async function clearDemoData({ email }: { email: string }): Promise<ClearResult> {
  const user = await requireUser(email);
  const removed = await removeDemoCars(user.id);

  return { userId: user.id, removed };
}
