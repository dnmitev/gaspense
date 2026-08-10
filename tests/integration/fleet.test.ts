import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, softDeleteCar } from "@/lib/cars";
import { createExpense, listExpensesForCar } from "@/lib/expenses";
import { getFleetSummary } from "@/lib/fleet";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { seedDefaultCategories } from "@/lib/seed-categories";
import type { ExpenseInput } from "@/lib/validation/expense";
import { createTestClient, resetDatabase } from "./helpers";

// This is the first query in the project not scoped to a single car id. A
// missing filter here does not leak one stranger's car — it totals everyone's
// spending onto one dashboard, so the cross-user case below carries more weight
// than its counterparts elsewhere.

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
    amountCents: 5_000,
    date: new Date("2026-03-01T00:00:00.000Z"),
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

  return { alice, bob, fuel };
}

async function addExpense(
  userId: string,
  carId: string,
  categoryId: string,
  overrides: Partial<ExpenseInput> = {},
) {
  const created = await createExpense(userId, expenseInput({ carId, categoryId, ...overrides }));
  if (created === null) throw new Error("fixture expense was refused");
  return created;
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getFleetSummary", () => {
  it("totals every car together and separately", async () => {
    // AC-1.
    const { alice, fuel } = await fixtures();
    const first = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });
    const second = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-02" });

    await addExpense(alice.id, first.id, fuel.id, { amountCents: 10_000 });
    await addExpense(alice.id, first.id, fuel.id, { amountCents: 2_500 });
    await addExpense(alice.id, second.id, fuel.id, { amountCents: 7_000 });

    const summary = await getFleetSummary(alice.id);

    expect(summary.totalCents).toBe(19_500);
    expect(summary.cars).toHaveLength(2);

    const byPlate = new Map(summary.cars.map((car) => [car.licensePlate, car]));
    expect(byPlate.get("ALICE-01")?.totalCents).toBe(12_500);
    expect(byPlate.get("ALICE-02")?.totalCents).toBe(7_000);
  });

  it("buckets spending by month across the whole fleet", async () => {
    const { alice, fuel } = await fixtures();
    const first = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });
    const second = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-02" });

    await addExpense(alice.id, first.id, fuel.id, {
      amountCents: 1_000,
      date: new Date("2026-03-05T00:00:00.000Z"),
    });
    await addExpense(alice.id, second.id, fuel.id, {
      amountCents: 2_000,
      date: new Date("2026-03-20T00:00:00.000Z"),
    });
    await addExpense(alice.id, first.id, fuel.id, {
      amountCents: 4_000,
      date: new Date("2026-05-01T00:00:00.000Z"),
    });

    const summary = await getFleetSummary(alice.id);

    // Both cars' March spending lands in one bucket — this is a FLEET series,
    // not a per-car one.
    expect(summary.byMonth.map((period) => period.key)).toEqual(["2026-05", "2026-03"]);
    expect(summary.byMonth[1].totalCents).toBe(3_000);
  });

  it("gives each car its own consumption, or null when it cannot be measured", async () => {
    // AC-4. Null rather than 0 — unknown and zero are different claims.
    const { alice, fuel } = await fixtures();
    const measurable = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });
    const bare = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-02" });

    await addExpense(alice.id, measurable.id, fuel.id, {
      liters: 40,
      odometer: 10_000,
      date: new Date("2026-03-01T00:00:00.000Z"),
    });
    await addExpense(alice.id, measurable.id, fuel.id, {
      liters: 50,
      odometer: 11_000,
      date: new Date("2026-03-15T00:00:00.000Z"),
    });
    await addExpense(alice.id, bare.id, fuel.id, { amountCents: 3_000 });

    const summary = await getFleetSummary(alice.id);
    const byPlate = new Map(summary.cars.map((car) => [car.licensePlate, car]));

    // 50 L over 1,000 km.
    expect(byPlate.get("ALICE-01")?.averageLitersPer100Km).toBeCloseTo(5, 6);
    expect(byPlate.get("ALICE-02")?.averageLitersPer100Km).toBeNull();
  });

  it("never includes another user's cars or spending", async () => {
    // AC-5, and the reason this suite exists. Bob's rows are re-read afterwards
    // rather than trusting that Alice's total happened to look right.
    const { alice, bob, fuel } = await fixtures();
    const aliceCar = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });
    const bobCar = await createCar(bob.id, { ...carInput, licensePlate: "BOB-01" });

    await addExpense(alice.id, aliceCar.id, fuel.id, { amountCents: 1_000 });
    await addExpense(bob.id, bobCar.id, fuel.id, { amountCents: 999_00 });

    const summary = await getFleetSummary(alice.id);

    expect(summary.totalCents).toBe(1_000);
    expect(summary.cars).toHaveLength(1);
    expect(summary.cars[0].licensePlate).toBe("ALICE-01");
    expect(summary.cars.map((car) => car.licensePlate)).not.toContain("BOB-01");

    // The victim's view, re-read.
    const bobsExpenses = await listExpensesForCar(bob.id, bobCar.id);
    expect(bobsExpenses).toHaveLength(1);
    expect(bobsExpenses[0].amountCents).toBe(999_00);
    expect((await getFleetSummary(bob.id)).totalCents).toBe(999_00);
  });

  it("drops a soft-deleted car without destroying its expenses", async () => {
    // AC-6. The rows survive; only the reachability goes.
    const { alice, fuel } = await fixtures();
    const kept = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });
    const removed = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-02" });

    await addExpense(alice.id, kept.id, fuel.id, { amountCents: 1_000 });
    await addExpense(alice.id, removed.id, fuel.id, { amountCents: 8_000 });

    await softDeleteCar(alice.id, removed.id);

    const summary = await getFleetSummary(alice.id);

    expect(summary.cars).toHaveLength(1);
    expect(summary.cars[0].licensePlate).toBe("ALICE-01");
    expect(summary.totalCents).toBe(1_000);

    // Still in the database — deleting a car must never destroy its history.
    expect(await prisma.expense.count({ where: { carId: removed.id } })).toBe(1);
  });

  it("returns an empty summary for a user with no cars", async () => {
    // AC-8. Not null, not an error — an honest zero the page can explain.
    const { alice } = await fixtures();

    expect(await getFleetSummary(alice.id)).toEqual({
      totalCents: 0,
      byMonth: [],
      cars: [],
    });
  });

  it("returns an empty summary when every car is soft-deleted", async () => {
    const { alice, fuel } = await fixtures();
    const car = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });
    await addExpense(alice.id, car.id, fuel.id, { amountCents: 4_000 });
    await softDeleteCar(alice.id, car.id);

    const summary = await getFleetSummary(alice.id);

    expect(summary.cars).toHaveLength(0);
    expect(summary.totalCents).toBe(0);
    expect(summary.byMonth).toEqual([]);
  });

  it("reports a car with no expenses as zero rather than omitting it", async () => {
    const { alice } = await fixtures();
    await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });

    const summary = await getFleetSummary(alice.id);

    expect(summary.cars).toHaveLength(1);
    expect(summary.cars[0].totalCents).toBe(0);
    expect(summary.cars[0].averageLitersPer100Km).toBeNull();
  });

  it("agrees with the per-car report for a single-car account", async () => {
    // A cross-check against 03-01's independently-tested path. If the roll-up
    // ever double-counts, these two diverge.
    const { alice, fuel } = await fixtures();
    const car = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" });

    await addExpense(alice.id, car.id, fuel.id, { amountCents: 4_520 });
    await addExpense(alice.id, car.id, fuel.id, { amountCents: 1_205 });
    await addExpense(alice.id, car.id, fuel.id, { amountCents: 7 });

    const { getCarReport } = await import("@/lib/reports");
    const summary = await getFleetSummary(alice.id);
    const report = await getCarReport(alice.id, car.id);

    expect(summary.totalCents).toBe(report?.totalCents);
    expect(summary.cars[0].totalCents).toBe(report?.totalCents);
    expect(summary.totalCents).toBe(5_732);
  });
});
