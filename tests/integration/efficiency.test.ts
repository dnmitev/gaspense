import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, softDeleteCar } from "@/lib/cars";
import { DECREASING_READING_INDEX } from "@/lib/demo-data";
import { createExpense, listExpensesForCar } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getCarEfficiency } from "@/lib/reports";
import { seedDefaultCategories } from "@/lib/seed-categories";
import { seedDemoData } from "@/lib/seed-demo";
import type { ExpenseInput } from "@/lib/validation/expense";
import { createTestClient, resetDatabase } from "./helpers";

// The calculation is proven exhaustively in tests/unit/consumption.test.ts.
// What this suite proves is different: that the QUERY hands it the right rows —
// litres, fullTank and the linked reading all surviving the round trip — and
// that a stranger gets nothing.

const prisma: PrismaClient = createTestClient();

const carInput = {
  fuelType: "DIESEL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

function expenseInput(overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    carId: "",
    categoryId: "",
    amountCents: 7_000,
    date: new Date("2026-01-01T00:00:00.000Z"),
    notes: undefined,
    liters: undefined,
    station: undefined,
    fullTank: true,
    odometer: undefined,
    ...overrides,
  };
}

async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  await seedDefaultCategories(prisma);
  const fuel = await prisma.category.findFirstOrThrow({ where: { userId: null, name: "Fuel" } });
  const insurance = await prisma.category.findFirstOrThrow({
    where: { userId: null, name: "Insurance" },
  });

  const [aliceCar, bobCar] = await Promise.all([
    createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" }),
    createCar(bob.id, { ...carInput, licensePlate: "BOB-01" }),
  ]);

  return { alice, bob, aliceCar, bobCar, fuel, insurance };
}

/** Records a fill through the real write path, so the reading is linked as the app links it. */
async function addFill(
  userId: string,
  carId: string,
  categoryId: string,
  day: number,
  liters: number,
  options: { full?: boolean; odometer?: number; cents?: number } = {},
) {
  const created = await createExpense(
    userId,
    expenseInput({
      carId,
      categoryId,
      liters,
      amountCents: options.cents ?? Math.round(liters * 175),
      fullTank: options.full ?? true,
      date: new Date(Date.UTC(2026, 0, day)),
      odometer: options.odometer,
    }),
  );

  if (created === null) throw new Error("fixture fill was refused");
  return created;
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getCarEfficiency", () => {
  it("computes a hand-checkable figure from real rows", async () => {
    // 1,400 km on 41.2 + 22.5 + 44.0 = 107.7 L → 7.6929 L/100km.
    const { alice, aliceCar, fuel } = await fixtures();

    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 142_000 });
    await addFill(alice.id, aliceCar.id, fuel.id, 11, 41.2);
    await addFill(alice.id, aliceCar.id, fuel.id, 21, 22.5, { full: false });
    await addFill(alice.id, aliceCar.id, fuel.id, 31, 44.0, { odometer: 143_400 });

    const result = await getCarEfficiency(alice.id, aliceCar.id);

    expect(result?.intervals).toHaveLength(1);
    expect(result?.intervals[0].distanceKm).toBe(1_400);
    expect(result?.intervals[0].liters).toBeCloseTo(107.7, 6);
    expect(result?.averageLitersPer100Km).toBeCloseTo(7.6929, 3);
  });

  it("carries fullTank and the linked reading through the query intact", async () => {
    // The calculation cannot distinguish "partial fill" from "field dropped on
    // the way out of the database", so assert the flags arrive.
    const { alice, aliceCar, fuel } = await fixtures();

    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 100_000 });
    await addFill(alice.id, aliceCar.id, fuel.id, 5, 30, { full: false, odometer: 100_500 });
    await addFill(alice.id, aliceCar.id, fuel.id, 9, 40, { odometer: 101_000 });

    const result = await getCarEfficiency(alice.id, aliceCar.id);

    // AC-3 through the database: the partial carries a reading and must still
    // not become an endpoint.
    expect(result?.intervals).toHaveLength(1);
    expect(result?.intervals[0].fromKm).toBe(100_000);
    expect(result?.intervals[0].toKm).toBe(101_000);
  });

  it("includes a fill whose odometer was never recorded", async () => {
    const { alice, aliceCar, fuel } = await fixtures();

    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 150_000 });
    await addFill(alice.id, aliceCar.id, fuel.id, 11, 45);
    await addFill(alice.id, aliceCar.id, fuel.id, 21, 50, { odometer: 152_000 });

    const result = await getCarEfficiency(alice.id, aliceCar.id);

    expect(result?.intervals).toHaveLength(1);
    expect(result?.intervals[0].liters).toBeCloseTo(95, 6);
  });

  it("separates fuel spend from total spend", async () => {
    // AC-5: the gap between them is the whole reason both are shown.
    const { alice, aliceCar, fuel, insurance } = await fixtures();

    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 10_000, cents: 7_000 });
    await addFill(alice.id, aliceCar.id, fuel.id, 11, 40, { odometer: 10_800, cents: 7_000 });
    await createExpense(
      alice.id,
      expenseInput({
        carId: aliceCar.id,
        categoryId: insurance.id,
        amountCents: 48_000,
        date: new Date("2026-01-05T00:00:00.000Z"),
        fullTank: false,
      }),
    );

    const result = await getCarEfficiency(alice.id, aliceCar.id);

    expect(result?.fuelCostCents).toBe(14_000);
    expect(result?.totalCostCents).toBe(62_000);
    expect(result?.totalCostCents).toBeGreaterThan(result?.fuelCostCents as number);
  });

  it("counts manual odometer readings toward the distance span", async () => {
    const { alice, aliceCar, fuel } = await fixtures();

    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 20_000 });
    await prisma.odometerReading.create({
      data: {
        carId: aliceCar.id,
        date: new Date("2026-03-01T00:00:00.000Z"),
        reading: 25_000,
        source: "MANUAL",
      },
    });

    const result = await getCarEfficiency(alice.id, aliceCar.id);

    expect(result?.distanceForCostKm).toBe(5_000);
  });

  it("reports unknown rather than zero when only one fill exists", async () => {
    // AC-7 at the data layer.
    const { alice, aliceCar, fuel } = await fixtures();
    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 1_000 });

    const result = await getCarEfficiency(alice.id, aliceCar.id);

    expect(result).not.toBeNull();
    expect(result?.intervals).toHaveLength(0);
    expect(result?.averageLitersPer100Km).toBeNull();
  });

  it("refuses another user's car, leaving their data intact", async () => {
    // AC-9. Re-reads the victim's rows: a function returning null
    // unconditionally would satisfy the first assertion on its own.
    const { alice, bob, bobCar, fuel } = await fixtures();

    await addFill(bob.id, bobCar.id, fuel.id, 1, 40, { odometer: 5_000, cents: 9_900 });
    await addFill(bob.id, bobCar.id, fuel.id, 11, 40, { odometer: 5_600, cents: 9_900 });

    expect(await getCarEfficiency(alice.id, bobCar.id)).toBeNull();

    const bobsExpenses = await listExpensesForCar(bob.id, bobCar.id);
    expect(bobsExpenses).toHaveLength(2);
    expect((await getCarEfficiency(bob.id, bobCar.id))?.intervals).toHaveLength(1);
  });

  it("has no efficiency for a soft-deleted car", async () => {
    const { alice, aliceCar, fuel } = await fixtures();
    await addFill(alice.id, aliceCar.id, fuel.id, 1, 40, { odometer: 1_000 });
    await softDeleteCar(alice.id, aliceCar.id);

    expect(await getCarEfficiency(alice.id, aliceCar.id)).toBeNull();
  });

  it("returns null for a car id that does not exist", async () => {
    const { alice } = await fixtures();

    expect(await getCarEfficiency(alice.id, "does-not-exist")).toBeNull();
  });
});

describe("getCarEfficiency — against the seeded demo year", () => {
  // The end-to-end proof: generated data, the real write path, the real query
  // and the real calculation all agreeing. Each is individually tested; this is
  // where a mismatch between them would show.
  it("produces a believable year of driving", async () => {
    const alice = await prisma.user.create({ data: { email: "demo@example.test" } });
    await seedDemoData({ email: alice.email, anchor: new Date("2026-06-15T00:00:00.000Z") });

    const car = await prisma.car.findFirstOrThrow({ where: { userId: alice.id } });
    const result = await getCarEfficiency(alice.id, car.id);

    expect(result?.averageLitersPer100Km).toBeGreaterThan(4);
    expect(result?.averageLitersPer100Km).toBeLessThan(14);
    expect(result?.intervals.length).toBeGreaterThan(15);
    expect(result?.distanceForCostKm).toBeGreaterThan(10_000);
    expect(result?.totalCostCents).toBeGreaterThan(result?.fuelCostCents as number);

    for (const interval of result?.intervals ?? []) {
      expect(interval.distanceKm).toBeGreaterThan(0);
      expect(Number.isFinite(interval.litersPer100Km)).toBe(true);
    }
  });

  it("swallows the fixture's mis-keyed reading rather than reporting it", async () => {
    // AC-4 end to end. The seeded series contains one reading that goes
    // backwards; no interval may terminate at it.
    const alice = await prisma.user.create({ data: { email: "demo@example.test" } });
    await seedDemoData({ email: alice.email, anchor: new Date("2026-06-15T00:00:00.000Z") });

    const car = await prisma.car.findFirstOrThrow({ where: { userId: alice.id } });
    const result = await getCarEfficiency(alice.id, car.id);

    const fills = await prisma.expense.findMany({
      where: { carId: car.id, liters: { not: null } },
      orderBy: { date: "asc" },
      include: { odometerReading: true },
    });
    const misKeyed = fills[DECREASING_READING_INDEX].odometerReading?.reading;

    expect(misKeyed).toBeDefined();
    for (const interval of result?.intervals ?? []) {
      expect(interval.toKm).not.toBe(misKeyed);
      expect(interval.fromKm).not.toBe(misKeyed);
    }
  });
});
