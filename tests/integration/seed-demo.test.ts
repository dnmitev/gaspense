import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar } from "@/lib/cars";
import { DEMO_PLATE } from "@/lib/demo-data";
import { createExpense, listExpensesForCar } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { clearDemoData, seedDemoData } from "@/lib/seed-demo";
import { seedDefaultCategories } from "@/lib/seed-categories";
import { createTestClient, resetDatabase } from "./helpers";

// This module DELETES cars, which makes its scoping worth more scrutiny than a
// read path's. The cross-user case below is the one that matters: two accounts
// each holding a car with the demo plate, where a delete filtered on the plate
// alone would take out the wrong person's.

const prisma: PrismaClient = createTestClient();

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");

const carInput = {
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

async function makeUser(email: string) {
  return prisma.user.create({ data: { email } });
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seedDemoData", () => {
  it("attaches a populated car to an existing account", async () => {
    // AC-1.
    const alice = await makeUser("alice@example.test");

    const result = await seedDemoData({ email: alice.email, anchor: ANCHOR });

    expect(result.userId).toBe(alice.id);
    expect(result.replaced).toBe(false);
    expect(result.expenses).toBe(47);

    const car = await prisma.car.findFirstOrThrow({ where: { userId: alice.id } });
    expect(car.licensePlate).toBe(DEMO_PLATE);

    const expenses = await listExpensesForCar(alice.id, car.id);
    expect(expenses).toHaveLength(47);

    // 28 fills, of which one carries no reading, plus 3 entered by hand.
    const readings = await prisma.odometerReading.count({ where: { carId: car.id } });
    expect(readings).toBe(27 + 3);
  });

  it("seeds the system categories itself", async () => {
    // resetDatabase truncates Category. If the seed did not re-create them,
    // createExpense would refuse every row — and truncation is precisely the
    // situation this command exists to recover from.
    const alice = await makeUser("alice@example.test");

    await expect(seedDemoData({ email: alice.email, anchor: ANCHOR })).resolves.toBeTruthy();

    expect(await prisma.category.count({ where: { userId: null } })).toBeGreaterThan(0);
  });

  it("links each fill's odometer reading to the expense that produced it", async () => {
    // The reason the seed goes through createExpense rather than createMany:
    // this pairing is owned by one audited function, not duplicated here.
    const alice = await makeUser("alice@example.test");
    await seedDemoData({ email: alice.email, anchor: ANCHOR });

    const linked = await prisma.odometerReading.count({
      where: { source: "EXPENSE", expenseId: { not: null } },
    });
    const manual = await prisma.odometerReading.count({ where: { source: "MANUAL" } });

    expect(linked).toBe(27);
    expect(manual).toBe(3);
  });

  it("carries the edge cases into the database, not just the dataset", async () => {
    // AC-4 end to end. The dataset asserts these too, but a mapping mistake in
    // this module could drop fullTank or odometer on the way through.
    const alice = await makeUser("alice@example.test");
    await seedDemoData({ email: alice.email, anchor: ANCHOR });

    const car = await prisma.car.findFirstOrThrow({ where: { userId: alice.id } });

    // Scoped to fuel rows. Non-fuel expenses also store fullTank false — the
    // form's schema coerces an absent checkbox to false rather than null, and
    // the seed matches the app rather than inventing a third state — so an
    // unscoped count here would be 20, not 1.
    expect(
      await prisma.expense.count({
        where: { carId: car.id, liters: { not: null }, fullTank: false },
      }),
    ).toBe(1);

    const fills = await prisma.expense.findMany({
      where: { carId: car.id, liters: { not: null } },
      orderBy: { date: "asc" },
      include: { odometerReading: true },
    });

    expect(fills.filter((fill) => fill.odometerReading === null)).toHaveLength(1);

    const series = fills
      .map((fill) => fill.odometerReading?.reading)
      .filter((reading): reading is number => reading !== undefined);
    const drops = series.filter((reading, index) => index > 0 && reading < series[index - 1]);

    expect(drops).toHaveLength(1);
  });

  it("is deterministic for a pinned anchor across a re-seed", async () => {
    // AC-3 through the database: the same anchor must produce the same totals,
    // which is what lets the e2e suite assert a hand-computed figure.
    const alice = await makeUser("alice@example.test");

    await seedDemoData({ email: alice.email, anchor: ANCHOR });
    const firstCar = await prisma.car.findFirstOrThrow({ where: { userId: alice.id } });
    const firstTotal = await prisma.expense.aggregate({
      where: { carId: firstCar.id },
      _sum: { amountCents: true },
    });

    await seedDemoData({ email: alice.email, anchor: ANCHOR });
    const secondCar = await prisma.car.findFirstOrThrow({ where: { userId: alice.id } });
    const secondTotal = await prisma.expense.aggregate({
      where: { carId: secondCar.id },
      _sum: { amountCents: true },
    });

    expect(secondTotal._sum.amountCents).toBe(firstTotal._sum.amountCents);
  });

  it("refuses an unknown email and creates nothing", async () => {
    // AC-2. Never creates the user: doing so would break their Google sign-in
    // with OAuthAccountNotLinked.
    await expect(seedDemoData({ email: "nobody@example.test", anchor: ANCHOR })).rejects.toThrow(
      /sign in with google/i,
    );

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.car.count()).toBe(0);
    expect(await prisma.expense.count()).toBe(0);
  });

  it("replaces the demo car but leaves a real car untouched", async () => {
    // AC-5.
    const alice = await makeUser("alice@example.test");
    await seedDefaultCategories(prisma);
    const category = await prisma.category.findFirstOrThrow({ where: { userId: null } });

    const realCar = await createCar(alice.id, { ...carInput, licensePlate: "REAL-0001" });
    await createExpense(alice.id, {
      carId: realCar.id,
      categoryId: category.id,
      amountCents: 12_345,
      date: new Date("2026-05-01T00:00:00.000Z"),
      notes: "Not demo data",
      liters: undefined,
      station: undefined,
      fullTank: false,
      odometer: undefined,
    });

    await seedDemoData({ email: alice.email, anchor: ANCHOR });
    const second = await seedDemoData({ email: alice.email, anchor: ANCHOR });

    expect(second.replaced).toBe(true);

    // Exactly one demo car, not two.
    expect(await prisma.car.count({ where: { userId: alice.id, licensePlate: DEMO_PLATE } })).toBe(
      1,
    );

    // And the real car is intact, re-read rather than assumed.
    const survivor = await prisma.car.findFirstOrThrow({ where: { id: realCar.id } });
    expect(survivor.deletedAt).toBeNull();
    const survivorExpenses = await listExpensesForCar(alice.id, realCar.id);
    expect(survivorExpenses).toHaveLength(1);
    expect(survivorExpenses[0].amountCents).toBe(12_345);
  });

  it("cannot touch another user's identically-plated car", async () => {
    // AC-6, and the reason this suite exists. A delete filtered on the plate
    // alone would destroy Bob's car here; the assertions re-read his rows
    // afterwards rather than trusting a count.
    const [alice, bob] = await Promise.all([
      makeUser("alice@example.test"),
      makeUser("bob@example.test"),
    ]);
    await seedDefaultCategories(prisma);
    const category = await prisma.category.findFirstOrThrow({ where: { userId: null } });

    const bobsCar = await createCar(bob.id, { ...carInput, licensePlate: DEMO_PLATE });
    await createExpense(bob.id, {
      carId: bobsCar.id,
      categoryId: category.id,
      amountCents: 9_900,
      date: new Date("2026-05-02T00:00:00.000Z"),
      notes: undefined,
      liters: undefined,
      station: undefined,
      fullTank: false,
      odometer: undefined,
    });

    await seedDemoData({ email: alice.email, anchor: ANCHOR });
    await clearDemoData({ email: alice.email });

    const survivor = await prisma.car.findFirst({ where: { id: bobsCar.id } });
    expect(survivor).not.toBeNull();

    const bobsExpenses = await listExpensesForCar(bob.id, bobsCar.id);
    expect(bobsExpenses).toHaveLength(1);
    expect(bobsExpenses[0].amountCents).toBe(9_900);
  });
});

describe("clearDemoData", () => {
  it("removes the demo car with its expenses and readings", async () => {
    // AC-7.
    const alice = await makeUser("alice@example.test");
    const seeded = await seedDemoData({ email: alice.email, anchor: ANCHOR });

    const result = await clearDemoData({ email: alice.email });

    expect(result.removed).toBe(1);
    expect(await prisma.car.count({ where: { id: seeded.carId } })).toBe(0);
    expect(await prisma.expense.count({ where: { carId: seeded.carId } })).toBe(0);
    expect(await prisma.odometerReading.count({ where: { carId: seeded.carId } })).toBe(0);
  });

  it("leaves the user's other cars alone", async () => {
    const alice = await makeUser("alice@example.test");
    const realCar = await createCar(alice.id, { ...carInput, licensePlate: "REAL-0002" });
    await seedDemoData({ email: alice.email, anchor: ANCHOR });

    await clearDemoData({ email: alice.email });

    expect(await prisma.car.count({ where: { id: realCar.id } })).toBe(1);
  });

  it("is safe to run when there is nothing to remove", async () => {
    const alice = await makeUser("alice@example.test");

    await expect(clearDemoData({ email: alice.email })).resolves.toEqual({
      userId: alice.id,
      removed: 0,
    });
  });

  it("refuses an unknown email", async () => {
    await expect(clearDemoData({ email: "nobody@example.test" })).rejects.toThrow(
      /sign in with google/i,
    );
  });
});
