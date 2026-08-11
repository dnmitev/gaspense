import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAttachmentForCar,
  createAttachmentForExpense,
  deleteAttachment,
  getAttachmentForUser,
  listAttachmentsForCar,
} from "@/lib/attachments";
import { createCar, softDeleteCar } from "@/lib/cars";
import { createExpense } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { seedDefaultCategories } from "@/lib/seed-categories";
import { createLocalStorage } from "@/lib/storage";
import { createTestClient, resetDatabase } from "./helpers";

/**
 * Car attachments, and the widened ownership scope they required.
 *
 * ⚠️ Before 04-04, every query in `lib/attachments.ts` scoped through `expense`
 * — so a row with a null `expenseId` matched nothing and the owner's own car
 * photo came back as a 404. The filter is now an OR over both ownership paths,
 * and an OR is exactly the shape that can be widened too far. Both directions
 * are tested: the owner reaches theirs, and a stranger reaches neither.
 */

const prisma: PrismaClient = createTestClient();

let storageRoot: string;

const carInput = {
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

const pngBytes = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22, 0x33]);

const input = (bytes: Uint8Array) => ({
  mimeType: "image/png",
  sizeBytes: bytes.byteLength,
  width: 100,
  height: 80,
});

async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  await seedDefaultCategories(prisma);
  const category = await prisma.category.findFirstOrThrow({ where: { userId: null } });

  const [aliceCar, bobCar] = await Promise.all([
    createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" }),
    createCar(bob.id, { ...carInput, licensePlate: "BOB-01" }),
  ]);

  const expenseFor = (carId: string) => ({
    carId,
    categoryId: category.id,
    amountCents: 4520,
    date: new Date("2026-08-01T00:00:00.000Z"),
    notes: undefined,
    liters: undefined,
    station: undefined,
    fullTank: false,
    odometer: undefined,
  });

  const bobExpense = await createExpense(bob.id, expenseFor(bobCar.id));
  const aliceExpense = await createExpense(alice.id, expenseFor(aliceCar.id));

  return { alice, bob, aliceCar, bobCar, aliceExpense: aliceExpense!, bobExpense: bobExpense! };
}

beforeEach(async () => {
  await resetDatabase(prisma);
  storageRoot = await mkdtemp(join(tmpdir(), "gaspense-car-attachments-"));
  process.env["STORAGE_LOCAL_ROOT"] = storageRoot;
});

afterEach(async () => {
  delete process.env["STORAGE_LOCAL_ROOT"];
  await rm(storageRoot, { recursive: true, force: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createAttachmentForCar", () => {
  it("stores a photo against the car, with no expense", async () => {
    const { alice, aliceCar } = await fixtures();
    const bytes = pngBytes();

    const result = await createAttachmentForCar(alice.id, aliceCar.id, input(bytes), bytes);
    expect(result.ok).toBe(true);

    const row = await prisma.attachment.findFirstOrThrow();
    expect(row.carId).toBe(aliceCar.id);
    expect(row.expenseId).toBeNull();
  });

  it("refuses a car belonging to someone else, and writes nothing", async () => {
    const { alice, bobCar } = await fixtures();
    const bytes = pngBytes();

    const result = await createAttachmentForCar(alice.id, bobCar.id, input(bytes), bytes);

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("refuses a soft-deleted car", async () => {
    const { alice, aliceCar } = await fixtures();
    await softDeleteCar(alice.id, aliceCar.id);
    const bytes = pngBytes();

    const result = await createAttachmentForCar(alice.id, aliceCar.id, input(bytes), bytes);

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(await prisma.attachment.count()).toBe(0);
  });
});

describe("the widened ownership scope", () => {
  it("lets the owner reach a CAR attachment — the 04-03 filter could not", async () => {
    // AC-1. This is the regression the plan exists for: scoping only through
    // `expense` makes a null expenseId match nothing at all.
    const { alice, aliceCar } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForCar(alice.id, aliceCar.id, input(bytes), bytes);
    const id = created.ok ? created.id : "";

    expect(await getAttachmentForUser(alice.id, id)).not.toBeNull();
  });

  it("still lets the owner reach an EXPENSE attachment", async () => {
    // The other half of the OR, which must not have been broken by widening.
    const { alice, aliceExpense } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForExpense(
      alice.id,
      aliceExpense.id,
      input(bytes),
      bytes,
    );
    const id = created.ok ? created.id : "";

    expect(await getAttachmentForUser(alice.id, id)).not.toBeNull();
  });

  it("does not let a stranger reach a car attachment, and leaves it intact", async () => {
    // AC-2. An OR is exactly the shape that widens too far.
    const { alice, bob, bobCar } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForCar(bob.id, bobCar.id, input(bytes), bytes);
    const id = created.ok ? created.id : "";

    expect(await getAttachmentForUser(alice.id, id)).toBeNull();
    expect(await listAttachmentsForCar(alice.id, bobCar.id)).toEqual([]);

    // Re-read as the owner: a function that always returned null would satisfy
    // the assertions above on its own.
    expect(await getAttachmentForUser(bob.id, id)).not.toBeNull();
  });

  it("does not let a stranger reach an expense attachment either", async () => {
    const { alice, bob, bobExpense } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForExpense(bob.id, bobExpense.id, input(bytes), bytes);
    const id = created.ok ? created.id : "";

    expect(await getAttachmentForUser(alice.id, id)).toBeNull();
    expect(await getAttachmentForUser(bob.id, id)).not.toBeNull();
  });

  it("keeps a car attachment and an expense attachment separate", async () => {
    // The specific thing a careless OR breaks: Alice's expense photo and Bob's
    // car photo both exist, and neither user may reach the other's.
    const { alice, bob, aliceExpense, bobCar } = await fixtures();
    const bytes = pngBytes();

    const aliceOwned = await createAttachmentForExpense(
      alice.id,
      aliceExpense.id,
      input(bytes),
      bytes,
    );
    const bobOwned = await createAttachmentForCar(bob.id, bobCar.id, input(bytes), bytes);

    const aliceId = aliceOwned.ok ? aliceOwned.id : "";
    const bobId = bobOwned.ok ? bobOwned.id : "";

    expect(await getAttachmentForUser(alice.id, aliceId)).not.toBeNull();
    expect(await getAttachmentForUser(alice.id, bobId)).toBeNull();
    expect(await getAttachmentForUser(bob.id, bobId)).not.toBeNull();
    expect(await getAttachmentForUser(bob.id, aliceId)).toBeNull();
  });
});

describe("a soft-deleted car", () => {
  it("stops serving its photo, but keeps the object", async () => {
    // Soft delete preserves history and photographs are history. The row and
    // the bytes survive; only reachability stops.
    const { alice, aliceCar } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForCar(alice.id, aliceCar.id, input(bytes), bytes);
    const id = created.ok ? created.id : "";
    const row = await prisma.attachment.findFirstOrThrow();

    await softDeleteCar(alice.id, aliceCar.id);

    expect(await getAttachmentForUser(alice.id, id)).toBeNull();
    expect(await listAttachmentsForCar(alice.id, aliceCar.id)).toEqual([]);

    expect(await prisma.attachment.count()).toBe(1);
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).not.toBeNull();
  });
});

describe("deleteAttachment on a car photo", () => {
  it("removes the row and the object", async () => {
    const { alice, aliceCar } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForCar(alice.id, aliceCar.id, input(bytes), bytes);
    const row = await prisma.attachment.findFirstOrThrow();

    const count = await deleteAttachment(alice.id, created.ok ? created.id : "");

    expect(count).toBe(1);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).toBeNull();
  });

  it("refuses a stranger's car photo and leaves the object in place", async () => {
    const { alice, bob, bobCar } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForCar(bob.id, bobCar.id, input(bytes), bytes);
    const row = await prisma.attachment.findFirstOrThrow();

    const count = await deleteAttachment(alice.id, created.ok ? created.id : "");

    expect(count).toBe(0);
    expect(await prisma.attachment.count()).toBe(1);
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).not.toBeNull();
  });
});
