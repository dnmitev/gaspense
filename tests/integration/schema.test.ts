import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createTestClient, resetDatabase } from "./helpers";

const prisma: PrismaClient = createTestClient();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("schema round-trip", () => {
  it("persists a user → car → expense chain and reads it back through relations", async () => {
    const user = await prisma.user.create({
      data: { email: "tester@example.test", name: "Test Person" },
    });

    const category = await prisma.category.create({
      data: { name: "Fuel", userId: null },
    });

    const car = await prisma.car.create({
      data: {
        userId: user.id,
        licensePlate: "TEST-0000",
        make: "Testla",
        fuelType: "DIESEL",
      },
    });

    await prisma.expense.create({
      data: {
        carId: car.id,
        categoryId: category.id,
        date: new Date("2026-01-15T00:00:00.000Z"),
        // 62.35 EUR — proves money survives as exact integer minor units.
        amountCents: 6235,
        liters: 41.27,
        station: "Somewhere",
        fullTank: true,
      },
    });

    const found = await prisma.expense.findFirstOrThrow({
      include: { car: { include: { user: true } }, category: true },
    });

    expect(found.amountCents).toBe(6235);
    expect(found.liters).toBeCloseTo(41.27, 2);
    expect(found.fullTank).toBe(true);
    expect(found.car.licensePlate).toBe("TEST-0000");
    expect(found.car.fuelType).toBe("DIESEL");
    expect(found.car.user.email).toBe("tester@example.test");
    expect(found.category.name).toBe("Fuel");
  });

  it("records odometer readings independently of expenses", async () => {
    const user = await prisma.user.create({ data: { email: "odo@example.test" } });
    const car = await prisma.car.create({
      data: { userId: user.id, licensePlate: "TEST-0001" },
    });

    await prisma.odometerReading.createMany({
      data: [
        { carId: car.id, date: new Date("2026-01-01T00:00:00.000Z"), reading: 100_000 },
        {
          carId: car.id,
          date: new Date("2026-02-01T00:00:00.000Z"),
          reading: 101_500,
          source: "EXPENSE",
        },
      ],
    });

    const readings = await prisma.odometerReading.findMany({
      where: { carId: car.id },
      orderBy: { date: "asc" },
    });

    expect(readings).toHaveLength(2);
    expect(readings[0]?.reading).toBe(100_000);
    expect(readings[0]?.source).toBe("MANUAL");
    expect(readings[1]?.source).toBe("EXPENSE");
  });
});

describe("soft delete", () => {
  it("distinguishes a soft-deleted car from an active one", async () => {
    const user = await prisma.user.create({ data: { email: "soft@example.test" } });

    const active = await prisma.car.create({
      data: { userId: user.id, licensePlate: "ACTIVE-01" },
    });
    const removed = await prisma.car.create({
      data: { userId: user.id, licensePlate: "DELETED-01", deletedAt: new Date() },
    });

    const visible = await prisma.car.findMany({ where: { deletedAt: null } });

    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(active.id);

    // The row still exists — soft delete must never destroy history.
    const all = await prisma.car.findMany();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.id)).toContain(removed.id);
  });

  it("keeps expenses reachable after their car is soft-deleted", async () => {
    const user = await prisma.user.create({ data: { email: "hist@example.test" } });
    const category = await prisma.category.create({ data: { name: "Fuel", userId: null } });
    const car = await prisma.car.create({
      data: { userId: user.id, licensePlate: "HIST-01" },
    });
    await prisma.expense.create({
      data: {
        carId: car.id,
        categoryId: category.id,
        date: new Date("2026-03-01T00:00:00.000Z"),
        amountCents: 1000,
      },
    });

    await prisma.car.update({ where: { id: car.id }, data: { deletedAt: new Date() } });

    // This is the entire point of soft delete: the expense history survives.
    const expenses = await prisma.expense.findMany({ where: { carId: car.id } });
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.amountCents).toBe(1000);
  });
});
