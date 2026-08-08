import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar } from "@/lib/cars";
import {
  createCategory,
  deleteCategory,
  listOwnCategories,
  listSystemCategories,
  listVisibleCategories,
  renameCategory,
} from "@/lib/categories";
import { createExpense } from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { seedDefaultCategories } from "@/lib/seed-categories";
import { createTestClient, resetDatabase } from "./helpers";

// Categories are the only table where one row can belong to everybody. That
// makes two things worth proving repeatedly:
//
//   1. a user cannot reach another user's category, the usual isolation rule;
//   2. a user cannot reach a SYSTEM category either — a rename there would
//      change the label for every account at once.
//
// The second is enforced by ordinary scoping rather than a special case, so
// these tests are what confirm the ordinary scoping is actually sufficient.

const prisma: PrismaClient = createTestClient();

async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  // resetDatabase truncates Category, so the system defaults must be re-seeded.
  await seedDefaultCategories(prisma);

  return { alice, bob };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("listVisibleCategories", () => {
  it("returns the system defaults plus the caller's own", async () => {
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Alice's category" });

    const names = (await listVisibleCategories(alice.id)).map((category) => category.name);

    expect(names).toContain("Fuel");
    expect(names).toContain("Alice's category");
  });

  it("excludes another user's categories", async () => {
    const { alice, bob } = await fixtures();
    await createCategory(bob.id, { name: "Bob's category" });

    const names = (await listVisibleCategories(alice.id)).map((category) => category.name);

    expect(names).not.toContain("Bob's category");
    // Bob does see it, so the filter scopes rather than hiding everything.
    const bobNames = (await listVisibleCategories(bob.id)).map((category) => category.name);
    expect(bobNames).toContain("Bob's category");
  });

  it("sorts by name so the select is not in insertion order", async () => {
    const { alice } = await fixtures();

    const names = (await listVisibleCategories(alice.id)).map((category) => category.name);

    expect(names).toEqual([...names].sort());
  });
});

describe("listOwnCategories", () => {
  it("excludes the system defaults — they are not the caller's to manage", async () => {
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });

    const own = await listOwnCategories(alice.id);

    expect(own.map((category) => category.name)).toEqual(["Servicing"]);
    expect(own.every((category) => category.userId === alice.id)).toBe(true);
  });

  it("excludes another user's categories", async () => {
    const { alice, bob } = await fixtures();
    await createCategory(bob.id, { name: "Bob's category" });

    expect(await listOwnCategories(alice.id)).toHaveLength(0);
  });
});

describe("createCategory", () => {
  it("always attaches the category to the caller, never to nobody", async () => {
    const { alice } = await fixtures();

    expect(await createCategory(alice.id, { name: "Servicing" })).toEqual({ ok: true });

    const created = await prisma.category.findFirstOrThrow({ where: { name: "Servicing" } });
    // userId null would have made it a system category visible to everyone.
    expect(created.userId).toBe(alice.id);
  });

  it("reports a duplicate name instead of throwing", async () => {
    // The partial unique index is raw SQL, so this arrives as P2002 with
    // nothing in the type system to catch it. Adding the same name twice is an
    // ordinary mistake and must not surface as a 500.
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });

    expect(await createCategory(alice.id, { name: "Servicing" })).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
    expect(await prisma.category.count({ where: { userId: alice.id } })).toBe(1);
  });

  it("lets a different user use the same name", async () => {
    // The index is on (userId, name), so names are unique per user, not globally.
    const { alice, bob } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });

    expect(await createCategory(bob.id, { name: "Servicing" })).toEqual({ ok: true });
  });

  it("lets a user shadow a system category name", async () => {
    // The two partial indexes are independent: system names are unique among
    // themselves, a user's among their own. "Fuel" may legitimately exist twice.
    const { alice } = await fixtures();

    expect(await createCategory(alice.id, { name: "Fuel" })).toEqual({ ok: true });
  });
});

describe("renameCategory", () => {
  it("renames the caller's own category", async () => {
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });
    const own = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });

    expect(await renameCategory(alice.id, own.id, { name: "Maintenance" })).toEqual({ ok: true });
    expect((await prisma.category.findUniqueOrThrow({ where: { id: own.id } })).name).toBe(
      "Maintenance",
    );
  });

  it("refuses a system category and leaves it unchanged for everyone", async () => {
    // The headline case: `where: { id, userId }` cannot match a row whose
    // userId is NULL, so no special case is needed to protect these.
    const { alice, bob } = await fixtures();
    const system = await prisma.category.findFirstOrThrow({
      where: { userId: null, name: "Fuel" },
    });

    expect(await renameCategory(alice.id, system.id, { name: "Petrol" })).toEqual({
      ok: false,
      reason: "not-found",
    });

    const after = await prisma.category.findUniqueOrThrow({ where: { id: system.id } });
    expect(after.name).toBe("Fuel");
    expect(after.userId).toBeNull();
    // And it is still visible, under its original name, to an unrelated user.
    expect((await listVisibleCategories(bob.id)).map((c) => c.name)).toContain("Fuel");
  });

  it("refuses another user's category and leaves it unmodified", async () => {
    const { alice, bob } = await fixtures();
    await createCategory(bob.id, { name: "Bob's category" });
    const bobs = await prisma.category.findFirstOrThrow({ where: { userId: bob.id } });

    expect(await renameCategory(alice.id, bobs.id, { name: "Stolen" })).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect((await prisma.category.findUniqueOrThrow({ where: { id: bobs.id } })).name).toBe(
      "Bob's category",
    );
  });

  it("reports a rename onto an existing name as a duplicate", async () => {
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });
    await createCategory(alice.id, { name: "Tolls" });
    const tolls = await prisma.category.findFirstOrThrow({ where: { name: "Tolls" } });

    expect(await renameCategory(alice.id, tolls.id, { name: "Servicing" })).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
  });
});

describe("deleteCategory", () => {
  it("deletes an unused category of the caller's", async () => {
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });
    const own = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });

    expect(await deleteCategory(alice.id, own.id)).toEqual({ ok: true });
    expect(await prisma.category.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("refuses a category in use, and says how many expenses use it", async () => {
    // Expense.category is onDelete: Restrict. Refusing with a count is more
    // useful than "in use", and far better than silently reassigning records.
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });
    const own = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });
    const car = await createCar(alice.id, {
      licensePlate: "ALICE-01",
      fuelType: "PETROL",
      make: undefined,
      model: undefined,
      nickname: undefined,
      year: undefined,
    });

    for (const notes of ["one", "two"]) {
      await createExpense(alice.id, {
        carId: car.id,
        categoryId: own.id,
        amountCents: 1000,
        date: new Date("2026-08-01T00:00:00.000Z"),
        notes,
        liters: undefined,
        station: undefined,
        fullTank: false,
      });
    }

    expect(await deleteCategory(alice.id, own.id)).toEqual({
      ok: false,
      reason: "in-use",
      expenseCount: 2,
    });
    // Nothing was destroyed or quietly moved.
    expect(await prisma.category.count({ where: { id: own.id } })).toBe(1);
    expect(await prisma.expense.count()).toBe(2);
  });

  it("refuses a system category", async () => {
    const { alice } = await fixtures();
    const system = await prisma.category.findFirstOrThrow({ where: { userId: null } });

    expect(await deleteCategory(alice.id, system.id)).toEqual({ ok: false, reason: "not-found" });
    expect(await prisma.category.count({ where: { id: system.id } })).toBe(1);
  });

  it("refuses another user's category and leaves it in place", async () => {
    const { alice, bob } = await fixtures();
    await createCategory(bob.id, { name: "Bob's category" });
    const bobs = await prisma.category.findFirstOrThrow({ where: { userId: bob.id } });

    expect(await deleteCategory(alice.id, bobs.id)).toEqual({ ok: false, reason: "not-found" });
    expect(await prisma.category.count({ where: { id: bobs.id } })).toBe(1);
  });
});

describe("listSystemCategories", () => {
  it("returns the seeded defaults, and only those", async () => {
    const { alice } = await fixtures();
    await createCategory(alice.id, { name: "Servicing" });

    const system = await listSystemCategories();

    expect(system.every((category) => category.userId === null)).toBe(true);
    expect(system.map((category) => category.name)).toContain("Fuel");
    expect(system.map((category) => category.name)).not.toContain("Servicing");
  });
});
