import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { DEFAULT_CATEGORIES, seedDefaultCategories } from "@/lib/seed-categories";
import { createTestClient, resetDatabase } from "./helpers";

const prisma: PrismaClient = createTestClient();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("default category seed", () => {
  it("inserts every default category on a fresh database", async () => {
    const inserted = await seedDefaultCategories(prisma);

    expect(inserted).toBe(DEFAULT_CATEGORIES.length);

    const names = await prisma.category.findMany({
      where: { userId: null },
      select: { name: true },
      orderBy: { name: "asc" },
    });

    expect(names.map((c) => c.name)).toEqual([...DEFAULT_CATEGORIES].sort());
  });

  it("is idempotent — running twice does not duplicate", async () => {
    await seedDefaultCategories(prisma);
    const secondRunInserted = await seedDefaultCategories(prisma);

    expect(secondRunInserted).toBe(0);

    const count = await prisma.category.count({ where: { userId: null } });
    expect(count).toBe(DEFAULT_CATEGORIES.length);
  });

  it("allows a user's own category to reuse a system default's name", async () => {
    await seedDefaultCategories(prisma);
    const user = await prisma.user.create({ data: { email: "cat@example.test" } });

    // The partial indexes are scoped by userId IS NULL / IS NOT NULL, so a
    // personal "Fuel" must not collide with the system "Fuel".
    const own = await prisma.category.create({
      data: { name: "Fuel", userId: user.id },
    });

    expect(own.userId).toBe(user.id);
    expect(await prisma.category.count({ where: { name: "Fuel" } })).toBe(2);
  });

  it("rejects a duplicate category for the same user", async () => {
    const user = await prisma.user.create({ data: { email: "dupe@example.test" } });
    await prisma.category.create({ data: { name: "Parking", userId: user.id } });

    await expect(
      prisma.category.create({ data: { name: "Parking", userId: user.id } }),
    ).rejects.toThrow();
  });
});
