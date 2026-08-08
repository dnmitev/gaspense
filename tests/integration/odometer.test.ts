import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, softDeleteCar } from "@/lib/cars";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  createReading,
  deleteReading,
  getReadingById,
  listReadingsForCar,
  updateReading,
} from "@/lib/odometer";
import type { OdometerInput } from "@/lib/validation/odometer";
import { createTestClient, resetDatabase } from "./helpers";

// OdometerReading carries no userId, exactly like Expense, so the same
// relation-scoping proof applies: every cross-user case re-reads the victim's
// row rather than trusting that the attacker got nothing back.

const prisma: PrismaClient = createTestClient();

const carInput = {
  licensePlate: "TEST-0001",
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

function readingInput(overrides: Partial<OdometerInput> = {}): OdometerInput {
  return {
    carId: "",
    date: new Date("2026-08-01T00:00:00.000Z"),
    reading: 120000,
    ...overrides,
  };
}

async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  const [aliceCar, bobCar] = await Promise.all([
    createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" }),
    createCar(bob.id, { ...carInput, licensePlate: "BOB-01" }),
  ]);

  return { alice, bob, aliceCar, bobCar };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createReading", () => {
  it("records a manual reading against the car", async () => {
    const { alice, aliceCar } = await fixtures();

    const reading = await createReading(alice.id, readingInput({ carId: aliceCar.id }));

    expect(reading?.carId).toBe(aliceCar.id);
    expect(reading?.reading).toBe(120000);
    expect(reading?.source).toBe("MANUAL");
    // A hand-entered reading is not tied to any expense.
    expect(reading?.expenseId).toBeNull();
  });

  it("refuses a car belonging to someone else, and creates nothing", async () => {
    const { alice, bob, bobCar } = await fixtures();

    expect(await createReading(alice.id, readingInput({ carId: bobCar.id }))).toBeNull();
    expect(await listReadingsForCar(bob.id, bobCar.id)).toHaveLength(0);
    expect(await prisma.odometerReading.count()).toBe(0);
  });

  it("refuses a soft-deleted car", async () => {
    const { alice, aliceCar } = await fixtures();
    await softDeleteCar(alice.id, aliceCar.id);

    expect(await createReading(alice.id, readingInput({ carId: aliceCar.id }))).toBeNull();
  });
});

describe("listReadingsForCar", () => {
  it("returns only the caller's readings for that car", async () => {
    const { alice, bob, aliceCar, bobCar } = await fixtures();
    await createReading(alice.id, readingInput({ carId: aliceCar.id, reading: 111 }));
    await createReading(bob.id, readingInput({ carId: bobCar.id, reading: 222 }));

    const readings = await listReadingsForCar(alice.id, aliceCar.id);

    expect(readings).toHaveLength(1);
    expect(readings[0]?.reading).toBe(111);
  });

  it("returns nothing when asked for another user's car", async () => {
    const { alice, bob, bobCar } = await fixtures();
    await createReading(bob.id, readingInput({ carId: bobCar.id }));

    expect(await listReadingsForCar(alice.id, bobCar.id)).toHaveLength(0);
    expect(await listReadingsForCar(bob.id, bobCar.id)).toHaveLength(1);
  });

  it("hides a soft-deleted car's readings without destroying them", async () => {
    const { alice, aliceCar } = await fixtures();
    await createReading(alice.id, readingInput({ carId: aliceCar.id }));

    await softDeleteCar(alice.id, aliceCar.id);

    expect(await listReadingsForCar(alice.id, aliceCar.id)).toHaveLength(0);
    expect(await prisma.odometerReading.count()).toBe(1);
  });

  it("orders newest first", async () => {
    const { alice, aliceCar } = await fixtures();
    await createReading(
      alice.id,
      readingInput({
        carId: aliceCar.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
        reading: 100000,
      }),
    );
    await createReading(
      alice.id,
      readingInput({
        carId: aliceCar.id,
        date: new Date("2026-08-01T00:00:00.000Z"),
        reading: 120000,
      }),
    );

    const readings = await listReadingsForCar(alice.id, aliceCar.id);

    expect(readings.map((entry) => entry.reading)).toEqual([120000, 100000]);
  });

  it("accepts a decreasing series — odometers get replaced", async () => {
    // The data layer records what the user says happened. Phase 3 decides what
    // to do about a series that does not climb.
    const { alice, aliceCar } = await fixtures();
    await createReading(
      alice.id,
      readingInput({ carId: aliceCar.id, date: new Date("2026-01-01"), reading: 200000 }),
    );
    await createReading(
      alice.id,
      readingInput({ carId: aliceCar.id, date: new Date("2026-08-01"), reading: 15 }),
    );

    expect(await listReadingsForCar(alice.id, aliceCar.id)).toHaveLength(2);
  });
});

describe("getReadingById", () => {
  it("returns null for another user's reading", async () => {
    const { alice, bob, bobCar } = await fixtures();
    const bobs = await createReading(bob.id, readingInput({ carId: bobCar.id }));

    expect(await getReadingById(alice.id, bobs!.id)).toBeNull();
    expect(await getReadingById(bob.id, bobs!.id)).not.toBeNull();
  });
});

describe("updateReading", () => {
  it("updates the caller's own reading", async () => {
    const { alice, aliceCar } = await fixtures();
    const created = await createReading(alice.id, readingInput({ carId: aliceCar.id }));

    const count = await updateReading(
      alice.id,
      created!.id,
      readingInput({ carId: aliceCar.id, reading: 130000 }),
    );

    expect(count).toBe(1);
    expect((await getReadingById(alice.id, created!.id))?.reading).toBe(130000);
  });

  it("refuses another user's reading and leaves it unmodified", async () => {
    const { alice, bob, aliceCar, bobCar } = await fixtures();
    const bobs = await createReading(bob.id, readingInput({ carId: bobCar.id, reading: 222 }));

    const count = await updateReading(
      alice.id,
      bobs!.id,
      readingInput({ carId: aliceCar.id, reading: 1 }),
    );

    expect(count).toBe(0);
    const after = await getReadingById(bob.id, bobs!.id);
    expect(after?.reading).toBe(222);
    expect(after?.carId).toBe(bobCar.id);
  });

  it("refuses to move a reading onto another user's car", async () => {
    const { alice, bob, aliceCar, bobCar } = await fixtures();
    const created = await createReading(alice.id, readingInput({ carId: aliceCar.id }));

    const count = await updateReading(alice.id, created!.id, readingInput({ carId: bobCar.id }));

    expect(count).toBe(0);
    expect((await getReadingById(alice.id, created!.id))?.carId).toBe(aliceCar.id);
    expect(await listReadingsForCar(bob.id, bobCar.id)).toHaveLength(0);
  });

  it("does not let an expense-sourced reading be relabelled as manual", async () => {
    // `source` is intentionally absent from the update payload. A reading that
    // came from a fill-up must keep saying so, or the log becomes unexplainable.
    const { alice, aliceCar } = await fixtures();
    const created = await prisma.odometerReading.create({
      data: {
        carId: aliceCar.id,
        date: new Date("2026-08-01T00:00:00.000Z"),
        reading: 120000,
        source: "EXPENSE",
      },
    });

    await updateReading(alice.id, created.id, readingInput({ carId: aliceCar.id, reading: 5 }));

    const after = await getReadingById(alice.id, created.id);
    expect(after?.reading).toBe(5);
    expect(after?.source).toBe("EXPENSE");
  });
});

describe("deleteReading", () => {
  it("deletes the caller's own reading", async () => {
    const { alice, aliceCar } = await fixtures();
    const created = await createReading(alice.id, readingInput({ carId: aliceCar.id }));

    expect(await deleteReading(alice.id, created!.id)).toBe(1);
    expect(await prisma.odometerReading.count()).toBe(0);
  });

  it("refuses another user's reading and leaves it in place", async () => {
    const { alice, bob, bobCar } = await fixtures();
    const bobs = await createReading(bob.id, readingInput({ carId: bobCar.id }));

    expect(await deleteReading(alice.id, bobs!.id)).toBe(0);
    expect(await getReadingById(bob.id, bobs!.id)).not.toBeNull();
  });
});
