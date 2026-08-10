import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAttachmentForExpense,
  deleteAttachment,
  getAttachmentForUser,
  listAttachmentsForExpense,
} from "@/lib/attachments";
import { createCar } from "@/lib/cars";
import { createExpense, deleteExpense } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { seedDefaultCategories } from "@/lib/seed-categories";
import { createLocalStorage } from "@/lib/storage";
import { createTestClient, resetDatabase } from "./helpers";

/**
 * Attachments: the database constraint, the ownership boundary, and cleanup.
 *
 * `Attachment` has no `userId` — ownership runs `expense → car → userId`, the
 * same shape as `Expense`, so a dropped relation filter is not a type error but
 * a query that quietly returns everyone's rows. Every cross-user test therefore
 * re-reads the VICTIM's row afterwards; a function that always returned
 * null/0 would satisfy the weaker assertion on its own.
 *
 * `STORAGE_LOCAL_ROOT` points at a temporary directory per test, so nothing
 * lands in the developer's own `.storage/`.
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

/** A real PNG header, so the byte-sniff check passes. */
const pngBytes = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22, 0x33]);

function attachmentInput(bytes: Uint8Array) {
  return { mimeType: "image/png", sizeBytes: bytes.byteLength, width: 100, height: 80 };
}

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

  const aliceExpense = await createExpense(alice.id, expenseFor(aliceCar.id));
  const bobExpense = await createExpense(bob.id, expenseFor(bobCar.id));

  return { alice, bob, aliceCar, bobCar, aliceExpense: aliceExpense!, bobExpense: bobExpense! };
}

beforeEach(async () => {
  await resetDatabase(prisma);
  storageRoot = await mkdtemp(join(tmpdir(), "gaspense-attachments-"));
  process.env["STORAGE_LOCAL_ROOT"] = storageRoot;
});

afterEach(async () => {
  delete process.env["STORAGE_LOCAL_ROOT"];
  await rm(storageRoot, { recursive: true, force: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the database constraint", () => {
  it("rejects an attachment owned by both a car and an expense", async () => {
    // AC-2. Prisma cannot express a CHECK, so this is the only thing standing
    // between the dual-nullable-foreign-key design and a meaningless comment.
    const { aliceCar, aliceExpense } = await fixtures();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Attachment" (id, "carId", "expenseId", "storageKey", "mimeType", "sizeBytes")
         VALUES ('both', $1, $2, 'k-both', 'image/png', 1)`,
        aliceCar.id,
        aliceExpense.id,
      ),
    ).rejects.toThrow();

    expect(await prisma.attachment.count()).toBe(0);
  });

  it("rejects an attachment owned by neither", async () => {
    await fixtures();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Attachment" (id, "storageKey", "mimeType", "sizeBytes")
         VALUES ('neither', 'k-neither', 'image/png', 1)`,
      ),
    ).rejects.toThrow();

    expect(await prisma.attachment.count()).toBe(0);
  });
});

describe("createAttachmentForExpense", () => {
  it("stores the row and the object", async () => {
    const { alice, aliceExpense } = await fixtures();
    const bytes = pngBytes();

    const result = await createAttachmentForExpense(
      alice.id,
      aliceExpense.id,
      attachmentInput(bytes),
      bytes,
    );

    expect(result.ok).toBe(true);

    const row = await prisma.attachment.findFirstOrThrow();
    expect(row.expenseId).toBe(aliceExpense.id);
    expect(row.carId).toBeNull();

    const object = await createLocalStorage(storageRoot).get(row.storageKey);
    expect(object).not.toBeNull();
    expect(Array.from(object!.body)).toEqual(Array.from(bytes));
  });

  it("refuses an expense belonging to someone else, and writes nothing", async () => {
    // AC-3 at the write boundary. An insert has no WHERE clause, so ownership
    // here is an explicit pre-check — the one place it could be forgotten.
    const { alice, bobExpense } = await fixtures();
    const bytes = pngBytes();

    const result = await createAttachmentForExpense(
      alice.id,
      bobExpense.id,
      attachmentInput(bytes),
      bytes,
    );

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("refuses bytes that do not match the declared type", async () => {
    const { alice, aliceExpense } = await fixtures();
    const notAPng = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

    const result = await createAttachmentForExpense(
      alice.id,
      aliceExpense.id,
      { mimeType: "image/png", sizeBytes: notAPng.byteLength },
      notAPng,
    );

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("refuses a declared size that disagrees with the bytes", async () => {
    // Otherwise the size limit is advisory: claim 10 bytes, send 10 MB.
    const { alice, aliceExpense } = await fixtures();
    const bytes = pngBytes();

    const result = await createAttachmentForExpense(
      alice.id,
      aliceExpense.id,
      { mimeType: "image/png", sizeBytes: 1 },
      bytes,
    );

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await prisma.attachment.count()).toBe(0);
  });
});

describe("reading attachments", () => {
  it("does not return another user's attachment, and leaves it intact", async () => {
    // AC-3. Re-read Bob's row afterwards: a function that always returned null
    // would pass the first assertion alone.
    const { alice, bob, bobExpense } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForExpense(
      bob.id,
      bobExpense.id,
      attachmentInput(bytes),
      bytes,
    );
    expect(created.ok).toBe(true);
    const attachmentId = created.ok ? created.id : "";

    expect(await getAttachmentForUser(alice.id, attachmentId)).toBeNull();
    expect(await listAttachmentsForExpense(alice.id, bobExpense.id)).toEqual([]);

    // Still Bob's, untouched.
    expect(await getAttachmentForUser(bob.id, attachmentId)).not.toBeNull();
  });
});

describe("deleteAttachment", () => {
  it("removes the row and the object", async () => {
    const { alice, aliceExpense } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForExpense(
      alice.id,
      aliceExpense.id,
      attachmentInput(bytes),
      bytes,
    );
    const row = await prisma.attachment.findFirstOrThrow();

    const count = await deleteAttachment(alice.id, created.ok ? created.id : "");

    expect(count).toBe(1);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).toBeNull();
  });

  it("refuses someone else's attachment and leaves the object in place", async () => {
    const { alice, bob, bobExpense } = await fixtures();
    const bytes = pngBytes();

    const created = await createAttachmentForExpense(
      bob.id,
      bobExpense.id,
      attachmentInput(bytes),
      bytes,
    );
    const row = await prisma.attachment.findFirstOrThrow();

    const count = await deleteAttachment(alice.id, created.ok ? created.id : "");

    expect(count).toBe(0);
    expect(await prisma.attachment.count()).toBe(1);
    // The object must survive too — deleting the bytes of a row you were not
    // allowed to delete is the same damage by another route.
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).not.toBeNull();
  });
});

describe("deleting the expense", () => {
  it("removes the attachment row AND its stored object", async () => {
    // AC-5. The cascade takes the row; only lib/expenses.ts can take the object,
    // because after the cascade nothing knows the key any more.
    const { alice, aliceExpense } = await fixtures();
    const bytes = pngBytes();

    await createAttachmentForExpense(alice.id, aliceExpense.id, attachmentInput(bytes), bytes);
    const row = await prisma.attachment.findFirstOrThrow();

    await deleteExpense(alice.id, aliceExpense.id);

    expect(await prisma.attachment.count()).toBe(0);
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).toBeNull();
  });

  it("leaves another user's attachment and object alone when the delete is refused", async () => {
    const { alice, bob, bobExpense } = await fixtures();
    const bytes = pngBytes();

    await createAttachmentForExpense(bob.id, bobExpense.id, attachmentInput(bytes), bytes);
    const row = await prisma.attachment.findFirstOrThrow();

    // Alice cannot delete Bob's expense — and must not delete its object either.
    const count = await deleteExpense(alice.id, bobExpense.id);

    expect(count).toBe(0);
    expect(await prisma.attachment.count()).toBe(1);
    expect(await createLocalStorage(storageRoot).get(row.storageKey)).not.toBeNull();
  });
});
