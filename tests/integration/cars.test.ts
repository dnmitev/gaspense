import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, getCarById, listActiveCars, softDeleteCar, updateCar } from "@/lib/cars";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createTestClient, resetDatabase } from "./helpers";

// The isolation template from 02-04, applied to every helper 02-05 adds.
// Isolation is application-layer with no RLS backstop, so each scoped function
// needs its own cross-user proof — and each assertion checks the victim's row
// afterwards, not just the return value.

const prisma: PrismaClient = createTestClient();

const input = {
  licensePlate: "TEST-0001",
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

async function twoUsers() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);
  return { alice, bob };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createCar", () => {
  it("attaches the car to the given user", async () => {
    const { alice } = await twoUsers();

    const car = await createCar(alice.id, { ...input, nickname: "Daily" });

    expect(car.userId).toBe(alice.id);
    expect(car.licensePlate).toBe("TEST-0001");
    expect(car.nickname).toBe("Daily");
    expect(car.deletedAt).toBeNull();
  });
});

describe("listActiveCars", () => {
  it("returns only the caller's cars", async () => {
    const { alice, bob } = await twoUsers();
    await createCar(alice.id, { ...input, licensePlate: "ALICE-01" });
    await createCar(bob.id, { ...input, licensePlate: "BOB-01" });

    const cars = await listActiveCars(alice.id);

    expect(cars).toHaveLength(1);
    expect(cars[0]?.licensePlate).toBe("ALICE-01");
  });

  it("excludes the caller's own soft-deleted cars", async () => {
    const { alice } = await twoUsers();
    const keep = await createCar(alice.id, { ...input, licensePlate: "ALICE-01" });
    const remove = await createCar(alice.id, { ...input, licensePlate: "ALICE-02" });

    await softDeleteCar(alice.id, remove.id);

    const cars = await listActiveCars(alice.id);
    expect(cars).toHaveLength(1);
    expect(cars[0]?.id).toBe(keep.id);
  });
});

describe("getCarById", () => {
  it("returns the caller's own car", async () => {
    const { alice } = await twoUsers();
    const car = await createCar(alice.id, input);

    expect((await getCarById(alice.id, car.id))?.id).toBe(car.id);
  });

  it("returns null for another user's car", async () => {
    const { alice, bob } = await twoUsers();
    const bobCar = await createCar(bob.id, { ...input, licensePlate: "BOB-01" });

    expect(await getCarById(alice.id, bobCar.id)).toBeNull();
  });

  it("returns null for a soft-deleted car", async () => {
    const { alice } = await twoUsers();
    const car = await createCar(alice.id, input);
    await softDeleteCar(alice.id, car.id);

    expect(await getCarById(alice.id, car.id)).toBeNull();
  });
});

describe("updateCar", () => {
  it("updates the caller's own car", async () => {
    const { alice } = await twoUsers();
    const car = await createCar(alice.id, input);

    const count = await updateCar(alice.id, car.id, { ...input, nickname: "Renamed" });

    expect(count).toBe(1);
    expect((await getCarById(alice.id, car.id))?.nickname).toBe("Renamed");
  });

  it("refuses to update another user's car and leaves it untouched", async () => {
    const { alice, bob } = await twoUsers();
    const bobCar = await createCar(bob.id, {
      ...input,
      licensePlate: "BOB-01",
      nickname: "Bob original",
    });

    const count = await updateCar(alice.id, bobCar.id, { ...input, nickname: "pwned" });
    expect(count).toBe(0);

    // Verify the victim's row, not merely the reported count.
    const after = await prisma.car.findUniqueOrThrow({ where: { id: bobCar.id } });
    expect(after.nickname).toBe("Bob original");
    expect(after.licensePlate).toBe("BOB-01");
  });
});

describe("softDeleteCar", () => {
  it("hides the caller's car without destroying the row", async () => {
    const { alice } = await twoUsers();
    const car = await createCar(alice.id, input);

    expect(await softDeleteCar(alice.id, car.id)).toBe(1);
    expect(await listActiveCars(alice.id)).toHaveLength(0);
    expect(await prisma.car.count({ where: { id: car.id } })).toBe(1);
  });

  it("refuses to delete another user's car and leaves it active", async () => {
    const { alice, bob } = await twoUsers();
    const bobCar = await createCar(bob.id, { ...input, licensePlate: "BOB-01" });

    expect(await softDeleteCar(alice.id, bobCar.id)).toBe(0);

    const after = await prisma.car.findUniqueOrThrow({ where: { id: bobCar.id } });
    expect(after.deletedAt).toBeNull();
  });

  it("is a no-op when the car is already deleted", async () => {
    const { alice } = await twoUsers();
    const car = await createCar(alice.id, input);

    expect(await softDeleteCar(alice.id, car.id)).toBe(1);
    expect(await softDeleteCar(alice.id, car.id)).toBe(0);
  });

  it("keeps the car's expense history — the whole point of soft delete", async () => {
    const { alice } = await twoUsers();
    const category = await prisma.category.create({ data: { name: "Fuel", userId: null } });
    const car = await createCar(alice.id, input);
    await prisma.expense.create({
      data: {
        carId: car.id,
        categoryId: category.id,
        date: new Date("2026-02-01T00:00:00.000Z"),
        amountCents: 4250,
      },
    });

    await softDeleteCar(alice.id, car.id);

    const expenses = await prisma.expense.findMany({ where: { carId: car.id } });
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.amountCents).toBe(4250);
  });
});
