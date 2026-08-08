import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, softDeleteCar } from "@/lib/cars";
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  listExpensesForCar,
  updateExpense,
} from "@/lib/expenses";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { seedDefaultCategories } from "@/lib/seed-categories";
import type { ExpenseInput } from "@/lib/validation/expense";
import { createTestClient, resetDatabase } from "./helpers";

// The isolation template from 02-04/02-05, applied to expenses.
//
// Expenses need it more than cars did: they carry no userId of their own, so
// every scope filter reaches through the `car` relation. A dropped relation
// filter is not a type error — it is a query that quietly returns everyone's
// rows. Each cross-user test therefore re-reads the VICTIM's row afterwards; a
// function that always returned 0 or [] would satisfy the weaker assertion.

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
 * `resetDatabase` truncates Category, so the system defaults must be re-seeded
 * per test — a test that assumed they were present would fail on the second run.
 */
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

  return { alice, bob, aliceCar, bobCar, category };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createExpense", () => {
  it("stores the expense against the car, in cents", async () => {
    const { alice, aliceCar, category } = await fixtures();

    const expense = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, notes: "Full tank" }),
    );

    expect(expense).not.toBeNull();
    expect(expense?.carId).toBe(aliceCar.id);
    expect(expense?.amountCents).toBe(4520);
    expect(expense?.notes).toBe("Full tank");
  });

  it("refuses a car belonging to someone else, and creates nothing", async () => {
    // AC-4. `create` has no WHERE clause, so this is guarded by an explicit
    // pre-check rather than a filter — the one spot where a missing check would
    // not show up as an empty result somewhere else.
    const { alice, bob, bobCar, category } = await fixtures();

    const result = await createExpense(
      alice.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id }),
    );

    expect(result).toBeNull();
    // The victim's view is what actually matters.
    expect(await listExpensesForCar(bob.id, bobCar.id)).toHaveLength(0);
    expect(await prisma.expense.count()).toBe(0);
  });

  it("refuses a category belonging to someone else", async () => {
    // Filing under a stranger's private category would leak its name back out
    // through the expense list.
    const { alice, bob, aliceCar } = await fixtures();
    const bobsCategory = await prisma.category.create({
      data: { userId: bob.id, name: "Bob's private category" },
    });

    const result = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: bobsCategory.id }),
    );

    expect(result).toBeNull();
    expect(await prisma.expense.count()).toBe(0);
  });

  it("refuses a soft-deleted car", async () => {
    const { alice, aliceCar, category } = await fixtures();
    await softDeleteCar(alice.id, aliceCar.id);

    const result = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    expect(result).toBeNull();
  });

  it("allows a system category, which belongs to nobody", async () => {
    const { alice, aliceCar, category } = await fixtures();

    expect(category.userId).toBeNull();
    expect(
      await createExpense(alice.id, expenseInput({ carId: aliceCar.id, categoryId: category.id })),
    ).not.toBeNull();
  });
});

describe("listExpensesForCar", () => {
  it("returns only the caller's expenses for that car", async () => {
    const { alice, bob, aliceCar, bobCar, category } = await fixtures();
    await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, notes: "alice" }),
    );
    await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id, notes: "bob" }),
    );

    const expenses = await listExpensesForCar(alice.id, aliceCar.id);

    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.notes).toBe("alice");
  });

  it("returns nothing when asked for another user's car", async () => {
    // AC-5. Alice knows Bob's carId and asks for it directly.
    const { alice, bob, bobCar, category } = await fixtures();
    await createExpense(bob.id, expenseInput({ carId: bobCar.id, categoryId: category.id }));

    expect(await listExpensesForCar(alice.id, bobCar.id)).toHaveLength(0);
    // Bob still sees his own.
    expect(await listExpensesForCar(bob.id, bobCar.id)).toHaveLength(1);
  });

  it("hides the expenses of a soft-deleted car without destroying them", async () => {
    // AC-6: the whole point of soft delete is that history survives.
    const { alice, aliceCar, category } = await fixtures();
    await createExpense(alice.id, expenseInput({ carId: aliceCar.id, categoryId: category.id }));

    await softDeleteCar(alice.id, aliceCar.id);

    expect(await listExpensesForCar(alice.id, aliceCar.id)).toHaveLength(0);
    expect(await prisma.expense.count()).toBe(1);
  });

  it("orders newest first", async () => {
    const { alice, aliceCar, category } = await fixtures();
    await createExpense(
      alice.id,
      expenseInput({
        carId: aliceCar.id,
        categoryId: category.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
        notes: "older",
      }),
    );
    await createExpense(
      alice.id,
      expenseInput({
        carId: aliceCar.id,
        categoryId: category.id,
        date: new Date("2026-08-01T00:00:00.000Z"),
        notes: "newer",
      }),
    );

    const expenses = await listExpensesForCar(alice.id, aliceCar.id);

    expect(expenses.map((expense) => expense.notes)).toEqual(["newer", "older"]);
  });

  it("includes the category so the list can name it without a second query", async () => {
    const { alice, aliceCar, category } = await fixtures();
    await createExpense(alice.id, expenseInput({ carId: aliceCar.id, categoryId: category.id }));

    const [expense] = await listExpensesForCar(alice.id, aliceCar.id);

    expect(expense?.category.name).toBe(category.name);
  });
});

describe("getExpenseById", () => {
  it("returns the caller's own expense", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const created = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    expect((await getExpenseById(alice.id, created!.id))?.id).toBe(created!.id);
  });

  it("returns null for another user's expense", async () => {
    const { alice, bob, bobCar, category } = await fixtures();
    const bobs = await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id }),
    );

    expect(await getExpenseById(alice.id, bobs!.id)).toBeNull();
    expect(await getExpenseById(bob.id, bobs!.id)).not.toBeNull();
  });

  it("returns null once the car is soft-deleted", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const created = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    await softDeleteCar(alice.id, aliceCar.id);

    expect(await getExpenseById(alice.id, created!.id)).toBeNull();
  });
});

describe("updateExpense", () => {
  it("updates the caller's own expense", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const created = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    const count = await updateExpense(
      alice.id,
      created!.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, amountCents: 700 }),
    );

    expect(count).toBe(1);
    expect((await getExpenseById(alice.id, created!.id))?.amountCents).toBe(700);
  });

  it("refuses another user's expense and leaves it unmodified", async () => {
    // AC-5. The `where` gate: the row being edited must already be the caller's.
    const { alice, bob, aliceCar, bobCar, category } = await fixtures();
    const bobs = await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id, amountCents: 4520 }),
    );

    const count = await updateExpense(
      alice.id,
      bobs!.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, amountCents: 1 }),
    );

    expect(count).toBe(0);
    // Read back as the victim: the row must be untouched, not merely unreturned.
    const after = await getExpenseById(bob.id, bobs!.id);
    expect(after?.amountCents).toBe(4520);
    expect(after?.carId).toBe(bobCar.id);
  });

  it("refuses to move an expense onto another user's car", async () => {
    // The mayWrite gate, in the other direction: the caller owns the row but
    // names a stranger's car as its new home.
    const { alice, bob, aliceCar, bobCar, category } = await fixtures();
    const created = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    const count = await updateExpense(
      alice.id,
      created!.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id }),
    );

    expect(count).toBe(0);
    expect((await getExpenseById(alice.id, created!.id))?.carId).toBe(aliceCar.id);
    expect(await listExpensesForCar(bob.id, bobCar.id)).toHaveLength(0);
  });

  it("moves an expense between the caller's own cars", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const second = await createCar(alice.id, { ...carInput, licensePlate: "ALICE-02" });
    const created = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    const count = await updateExpense(
      alice.id,
      created!.id,
      expenseInput({ carId: second.id, categoryId: category.id }),
    );

    expect(count).toBe(1);
    expect(await listExpensesForCar(alice.id, second.id)).toHaveLength(1);
  });
});

describe("deleteExpense", () => {
  it("deletes the caller's own expense", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const created = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    expect(await deleteExpense(alice.id, created!.id)).toBe(1);
    expect(await prisma.expense.count()).toBe(0);
  });

  it("refuses another user's expense and leaves it in place", async () => {
    const { alice, bob, bobCar, category } = await fixtures();
    const bobs = await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id }),
    );

    expect(await deleteExpense(alice.id, bobs!.id)).toBe(0);
    expect(await getExpenseById(bob.id, bobs!.id)).not.toBeNull();
  });
});

describe("odometer capture on an expense", () => {
  it("creates a linked EXPENSE-sourced reading when one is entered", async () => {
    const { alice, aliceCar, category } = await fixtures();

    const expense = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: 120000 }),
    );

    const reading = await prisma.odometerReading.findUniqueOrThrow({
      where: { expenseId: expense!.id },
    });
    expect(reading.reading).toBe(120000);
    expect(reading.source).toBe("EXPENSE");
    expect(reading.carId).toBe(aliceCar.id);
    expect(reading.date).toEqual(expense!.date);
  });

  it("creates no reading when the field is left blank", async () => {
    // Blank means "not recorded", which must not become a reading of zero.
    const { alice, aliceCar, category } = await fixtures();

    await createExpense(alice.id, expenseInput({ carId: aliceCar.id, categoryId: category.id }));

    expect(await prisma.odometerReading.count()).toBe(0);
  });

  it("updates the linked reading, carrying the date across", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const expense = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: 120000 }),
    );

    await updateExpense(
      alice.id,
      expense!.id,
      expenseInput({
        carId: aliceCar.id,
        categoryId: category.id,
        odometer: 130000,
        date: new Date("2026-09-01T00:00:00.000Z"),
      }),
    );

    const reading = await prisma.odometerReading.findUniqueOrThrow({
      where: { expenseId: expense!.id },
    });
    expect(reading.reading).toBe(130000);
    // A reading left on the old date would show the fill-up on a day it did not happen.
    expect(reading.date).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  });

  it("creates a reading when one is added to an expense that had none", async () => {
    const { alice, aliceCar, category } = await fixtures();
    const expense = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id }),
    );

    await updateExpense(
      alice.id,
      expense!.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: 99000 }),
    );

    expect(
      (await prisma.odometerReading.findUniqueOrThrow({ where: { expenseId: expense!.id } }))
        .reading,
    ).toBe(99000);
  });

  it("deletes the reading when the field is cleared", async () => {
    // AC-8. The reading existed only as part of this expense, so it must not
    // linger as an unexplained manual entry.
    const { alice, aliceCar, category } = await fixtures();
    const expense = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: 120000 }),
    );

    await updateExpense(
      alice.id,
      expense!.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: undefined }),
    );

    expect(await prisma.odometerReading.count()).toBe(0);
  });

  it("removes the reading when the expense is deleted", async () => {
    // The cascade is a database guarantee, so assert it rather than trusting
    // that the schema says what it means.
    const { alice, aliceCar, category } = await fixtures();
    const expense = await createExpense(
      alice.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: 120000 }),
    );

    await deleteExpense(alice.id, expense!.id);

    expect(await prisma.odometerReading.count()).toBe(0);
  });

  it("leaves a stranger's reading untouched when their expense cannot be edited", async () => {
    const { alice, bob, aliceCar, bobCar, category } = await fixtures();
    const bobs = await createExpense(
      bob.id,
      expenseInput({ carId: bobCar.id, categoryId: category.id, odometer: 222 }),
    );

    const count = await updateExpense(
      alice.id,
      bobs!.id,
      expenseInput({ carId: aliceCar.id, categoryId: category.id, odometer: 1 }),
    );

    expect(count).toBe(0);
    expect(
      (await prisma.odometerReading.findUniqueOrThrow({ where: { expenseId: bobs!.id } })).reading,
    ).toBe(222);
  });
});
