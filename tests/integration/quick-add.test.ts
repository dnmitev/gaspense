import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, listActiveCars, softDeleteCar } from "@/lib/cars";
import { createExpense, listExpensesForCar } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { resolveQuickAddTarget } from "@/lib/quick-add";
import { seedDefaultCategories } from "@/lib/seed-categories";
import { createTestClient, resetDatabase } from "./helpers";

/**
 * The car-agnostic add route's data path.
 *
 * The route composes two things that already exist — `listActiveCars` for the
 * picker's options and `createExpense` for the write. Neither is new, but the
 * COMPOSITION is, and a new call site is exactly where scoping gets forgotten.
 *
 * Being straight about the overlap: `createExpense`'s refusal of a foreign car
 * is already proven in expenses.test.ts. It is re-proven here because the quick
 * -add form offers a car `<select>` rather than a hidden field, which makes
 * "the client chooses the car" a visible affordance rather than an implementation
 * detail — the claim deserves a test at this call site, not a cross-reference.
 *
 * What is genuinely new: that the picker's option list can never contain another
 * user's car, so the affordance cannot even present the wrong choice.
 */

const prisma: PrismaClient = createTestClient();

const carInput = {
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  // resetDatabase truncates Category, so the system defaults are re-seeded here.
  await seedDefaultCategories(prisma);
  const category = await prisma.category.findFirstOrThrow({ where: { userId: null } });

  const [aliceCar, bobCar] = await Promise.all([
    createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" }),
    createCar(bob.id, { ...carInput, licensePlate: "BOB-01" }),
  ]);

  return { alice, bob, aliceCar, bobCar, category };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the quick-add picker's options", () => {
  it("never contains another user's car", async () => {
    const { alice, aliceCar, bobCar } = await fixtures();

    const cars = await listActiveCars(alice.id);
    const ids = cars.map((car) => car.id);

    expect(ids).toContain(aliceCar.id);
    expect(ids).not.toContain(bobCar.id);
  });

  it("resolves to the user's own car, never to a stranger's", async () => {
    const { alice, aliceCar } = await fixtures();

    const target = resolveQuickAddTarget(await listActiveCars(alice.id));

    // One car each, so this is the single case — and the id must be Alice's.
    expect(target).toEqual({ kind: "single", carId: aliceCar.id });
  });

  it("reports no-cars once the only car is soft-deleted", async () => {
    // The route redirects to /cars/new on this, so getting it wrong means an
    // expense form with an empty picker rather than a dead end being avoided.
    const { alice, aliceCar } = await fixtures();
    await softDeleteCar(alice.id, aliceCar.id);

    expect(resolveQuickAddTarget(await listActiveCars(alice.id))).toEqual({ kind: "no-cars" });
  });

  it("asks, defaulting to the most recently added, once there are two", async () => {
    const { alice, aliceCar } = await fixtures();
    const second = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-02" });

    const target = resolveQuickAddTarget(await listActiveCars(alice.id));

    // createdAt: "desc" — the newest car is the default, not the first created.
    expect(target).toEqual({ kind: "choose", defaultCarId: second.id });
    expect(target).not.toEqual({ kind: "choose", defaultCarId: aliceCar.id });
  });
});

describe("the quick-add write path", () => {
  it("refuses a submitted carId belonging to someone else, and changes nothing", async () => {
    // AC-3. The form posts carId, so a tampered payload is the obvious attack on
    // this route. Re-read the VICTIM's list afterwards: a function that always
    // returned null would satisfy the weaker half of this assertion on its own.
    const { alice, bob, bobCar, category } = await fixtures();

    const before = await listExpensesForCar(bob.id, bobCar.id);

    const created = await createExpense(alice.id, {
      carId: bobCar.id,
      categoryId: category.id,
      amountCents: 4520,
      date: new Date("2026-08-01T00:00:00.000Z"),
      notes: undefined,
      liters: undefined,
      station: undefined,
      fullTank: false,
      odometer: undefined,
    });

    expect(created).toBeNull();

    const after = await listExpensesForCar(bob.id, bobCar.id);
    expect(after).toHaveLength(before.length);
    expect(after).toHaveLength(0);
  });

  it("writes to the user's own car through the same path", async () => {
    // The positive control. Without it, the refusal above would also pass
    // against a createExpense that had simply stopped working.
    const { alice, aliceCar, category } = await fixtures();

    const created = await createExpense(alice.id, {
      carId: aliceCar.id,
      categoryId: category.id,
      amountCents: 4520,
      date: new Date("2026-08-01T00:00:00.000Z"),
      notes: undefined,
      liters: 38.5,
      station: undefined,
      fullTank: true,
      odometer: 120_450,
    });

    expect(created).not.toBeNull();
    expect(created?.carId).toBe(aliceCar.id);

    const expenses = await listExpensesForCar(alice.id, aliceCar.id);
    expect(expenses).toHaveLength(1);
  });
});
