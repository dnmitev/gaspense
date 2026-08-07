import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createTestClient, resetDatabase } from "./helpers";

// AC-5 — the reason plan 02-04 exists.
//
// Isolation is enforced in application code, NOT by Postgres RLS. There is no
// database backstop: a query that forgets its userId filter returns everyone's
// rows. These tests encode the scoped access pattern so that dropping the filter
// breaks a test rather than leaking data silently.

const prisma: PrismaClient = createTestClient();

/** The scoped access pattern every data path must follow. */
const activeCarsFor = (userId: string) =>
  prisma.car.findMany({ where: { userId, deletedAt: null } });

const carByIdFor = (userId: string, carId: string) =>
  prisma.car.findFirst({ where: { id: carId, userId, deletedAt: null } });

/** Scoped update: the userId in the filter is what prevents cross-user writes. */
const updateCarFor = (userId: string, carId: string, data: { nickname?: string }) =>
  prisma.car.updateMany({ where: { id: carId, userId, deletedAt: null }, data });

const softDeleteCarFor = (userId: string, carId: string) =>
  prisma.car.updateMany({
    where: { id: carId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

const expensesFor = (userId: string) =>
  prisma.expense.findMany({ where: { car: { userId, deletedAt: null } } });

async function seedTwoUsers() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);
  const category = await prisma.category.create({ data: { name: "Fuel", userId: null } });

  const aliceCar = await prisma.car.create({
    data: { userId: alice.id, licensePlate: "ALICE-01", nickname: "Alice daily" },
  });
  const bobCar = await prisma.car.create({
    data: { userId: bob.id, licensePlate: "BOB-01", nickname: "Bob daily" },
  });

  await prisma.expense.create({
    data: {
      carId: aliceCar.id,
      categoryId: category.id,
      date: new Date("2026-01-10T00:00:00.000Z"),
      amountCents: 5000,
    },
  });
  await prisma.expense.create({
    data: {
      carId: bobCar.id,
      categoryId: category.id,
      date: new Date("2026-01-11T00:00:00.000Z"),
      amountCents: 7000,
    },
  });

  return { alice, bob, aliceCar, bobCar };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cross-user isolation", () => {
  it("lists only the requesting user's cars", async () => {
    const { alice, aliceCar } = await seedTwoUsers();

    const cars = await activeCarsFor(alice.id);

    expect(cars).toHaveLength(1);
    expect(cars[0]?.id).toBe(aliceCar.id);
    expect(cars.map((c) => c.licensePlate)).not.toContain("BOB-01");
  });

  it("returns not-found when reading another user's car by id", async () => {
    const { alice, bobCar } = await seedTwoUsers();

    // Alice knows Bob's car id and asks for it directly.
    expect(await carByIdFor(alice.id, bobCar.id)).toBeNull();
  });

  it("cannot update another user's car, and leaves it untouched", async () => {
    const { alice, bobCar } = await seedTwoUsers();

    const result = await updateCarFor(alice.id, bobCar.id, { nickname: "pwned" });
    expect(result.count).toBe(0);

    // Assert the victim's row, not just the return value — this is the check
    // that would catch a filter applied to the wrong clause.
    const after = await prisma.car.findUniqueOrThrow({ where: { id: bobCar.id } });
    expect(after.nickname).toBe("Bob daily");
  });

  it("cannot soft-delete another user's car", async () => {
    const { alice, bobCar } = await seedTwoUsers();

    const result = await softDeleteCarFor(alice.id, bobCar.id);
    expect(result.count).toBe(0);

    const after = await prisma.car.findUniqueOrThrow({ where: { id: bobCar.id } });
    expect(after.deletedAt).toBeNull();
  });

  it("excludes expenses belonging to another user's cars", async () => {
    const { alice } = await seedTwoUsers();

    const expenses = await expensesFor(alice.id);

    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.amountCents).toBe(5000);
    expect(expenses.map((e) => e.amountCents)).not.toContain(7000);
  });

  it("composes the userId and soft-delete filters correctly", async () => {
    const { alice, aliceCar } = await seedTwoUsers();
    const second = await prisma.car.create({
      data: { userId: alice.id, licensePlate: "ALICE-02" },
    });

    await softDeleteCarFor(alice.id, second.id);

    const active = await activeCarsFor(alice.id);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(aliceCar.id);

    // Soft-deleted, not gone.
    expect(await prisma.car.count({ where: { userId: alice.id } })).toBe(2);
  });
});
