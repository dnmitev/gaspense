import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, softDeleteCar } from "@/lib/cars";
import { createExpense, listExpensesForCar } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getCarReport } from "@/lib/reports";
import { seedDefaultCategories } from "@/lib/seed-categories";
import type { ExpenseInput } from "@/lib/validation/expense";
import { createTestClient, resetDatabase } from "./helpers";

// The isolation template from 02-04/05/06/07, applied to reports.
//
// A report needs it as much as any write path did, and arguably reads worse
// when it leaks: a total is a single number with no row to inspect, so a
// missing relation filter would show up as "my car cost more than I thought"
// rather than as a stranger's data appearing on screen.
//
// Every cross-user case therefore re-reads the VICTIM's expenses afterwards. A
// getCarReport that always returned null would satisfy the weaker assertion on
// its own.

const prisma: PrismaClient = createTestClient();

const carInput = {
  licensePlate: "TEST-0001",
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

function expenseInput(overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    carId: "",
    categoryId: "",
    amountCents: 4520,
    date: new Date("2026-08-01T00:00:00.000Z"),
    notes: undefined,
    liters: undefined,
    station: undefined,
    fullTank: false,
    odometer: undefined,
    ...overrides,
  };
}

/**
 * Two users, each with a car, plus the seeded system categories.
 *
 * `resetDatabase` truncates Category, so the system defaults are re-seeded per
 * test — a suite that assumed they survived would pass once and fail on the
 * second run, and in CI would fail on the first.
 */
async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  await seedDefaultCategories(prisma);
  const fuel = await prisma.category.findFirstOrThrow({ where: { userId: null, name: "Fuel" } });
  const maintenance = await prisma.category.findFirstOrThrow({
    where: { userId: null, name: "Maintenance" },
  });

  const [aliceCar, bobCar] = await Promise.all([
    createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" }),
    createCar(bob.id, { ...carInput, licensePlate: "BOB-01" }),
  ]);

  return { alice, bob, aliceCar, bobCar, fuel, maintenance };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getCarReport", () => {
  it("totals real rows to a hand-computed figure", async () => {
    // AC-1, against the database rather than an array literal: €45.20 + €12.05
    // + €0.07 = €57.32.
    const { alice, aliceCar, fuel } = await fixtures();

    for (const amountCents of [4520, 1205, 7]) {
      await createExpense(
        alice.id,
        expenseInput({ carId: aliceCar.id, categoryId: fuel.id, amountCents }),
      );
    }

    const report = await getCarReport(alice.id, aliceCar.id);

    expect(report?.totalCents).toBe(5732);
  });

  it("buckets by year and month, newest first, skipping empty periods", async () => {
    // AC-2 and AC-3 end to end: the dates make the round trip through Postgres
    // as timestamps, so this also proves nothing shifts them on the way back.
    const { alice, aliceCar, fuel } = await fixtures();

    const dates = ["2025-12-31", "2026-01-01", "2026-03-04", "2026-06-11"];
    for (const date of dates) {
      await createExpense(
        alice.id,
        expenseInput({
          carId: aliceCar.id,
          categoryId: fuel.id,
          amountCents: 1000,
          date: new Date(`${date}T00:00:00.000Z`),
        }),
      );
    }

    const report = await getCarReport(alice.id, aliceCar.id);

    expect(report?.byYear.map((period) => period.key)).toEqual(["2026", "2025"]);
    expect(report?.byYear[0].totalCents).toBe(3000);
    // April and May are absent, not zero rows.
    expect(report?.byMonth.map((period) => period.key)).toEqual([
      "2026-06",
      "2026-03",
      "2026-01",
      "2025-12",
    ]);
  });

  it("breaks spend down by category, biggest first, with names", async () => {
    // AC-4.
    const { alice, aliceCar, fuel, maintenance } = await fixtures();

    await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: fuel.id, amountCents: 30000 }),
    );
    await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: maintenance.id, amountCents: 8000 }),
    );

    const report = await getCarReport(alice.id, aliceCar.id);

    expect(report?.byCategory).toEqual([
      { categoryId: fuel.id, name: "Fuel", totalCents: 30000 },
      { categoryId: maintenance.id, name: "Maintenance", totalCents: 8000 },
    ]);
    // A seeded category with nothing filed against it must not appear.
    expect(report?.byCategory.map((category) => category.name)).not.toContain("Parking");
  });

  it("refuses another user's car, leaving their expenses intact", async () => {
    // AC-5. The victim's view is what actually matters: a function that
    // returned null unconditionally would pass the first assertion alone.
    const { alice, bob, bobCar, fuel } = await fixtures();

    await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: fuel.id, amountCents: 9900 }),
    );

    expect(await getCarReport(alice.id, bobCar.id)).toBeNull();

    const bobsExpenses = await listExpensesForCar(bob.id, bobCar.id);
    expect(bobsExpenses).toHaveLength(1);
    expect(bobsExpenses[0].amountCents).toBe(9900);
    expect((await getCarReport(bob.id, bobCar.id))?.totalCents).toBe(9900);
  });

  it("never mixes one user's spending into another's total", async () => {
    // The failure this guards is subtler than a leaked row: if the `car`
    // relation filter were dropped, `carId` alone would still scope correctly,
    // but a report built from an unscoped query would sum both cars. Assert
    // each user sees only their own figure.
    const { alice, bob, aliceCar, bobCar, fuel } = await fixtures();

    await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: fuel.id, amountCents: 100 }),
    );
    await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: fuel.id, amountCents: 5000 }),
    );

    expect((await getCarReport(alice.id, aliceCar.id))?.totalCents).toBe(100);
    expect((await getCarReport(bob.id, bobCar.id))?.totalCents).toBe(5000);
  });

  it("has no reachable report for a soft-deleted car, but keeps its rows", async () => {
    // AC-6: the expense history survives the car precisely so it is not lost —
    // it just stops being reachable.
    const { alice, aliceCar, fuel } = await fixtures();

    await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: fuel.id, amountCents: 2500 }),
    );
    await softDeleteCar(alice.id, aliceCar.id);

    expect(await getCarReport(alice.id, aliceCar.id)).toBeNull();
    expect(await prisma.expense.count({ where: { carId: aliceCar.id } })).toBe(1);
  });

  it("returns a zero report for a car with no expenses, not null", async () => {
    // AC-8. This is the case that makes the ownership pre-check necessary: an
    // empty query result alone cannot tell this apart from "not your car".
    const { alice, aliceCar } = await fixtures();

    const report = await getCarReport(alice.id, aliceCar.id);

    expect(report).not.toBeNull();
    expect(report).toEqual({ totalCents: 0, byYear: [], byMonth: [], byCategory: [] });
  });

  it("returns null for a car id that does not exist", async () => {
    const { alice } = await fixtures();

    expect(await getCarReport(alice.id, "does-not-exist")).toBeNull();
  });
});
