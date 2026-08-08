import { describe, expect, it } from "vitest";
import { formatAmountInput } from "@/lib/money";
import { MAX_AMOUNT_CENTS, expenseInputSchema } from "@/lib/validation/expense";

/**
 * A minimal valid submission; individual tests override one field at a time.
 *
 * Typed as a loose record rather than an inferred literal, because that is what
 * a form actually hands to `safeParse` — unvalidated keys of unknown type. It
 * also lets a test delete a key to model a field the browser never sent.
 */
function submission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    carId: "car_1",
    categoryId: "cat_1",
    amountCents: "45.20",
    date: "2026-08-01",
    notes: "",
    liters: "",
    station: "",
    fullTank: undefined,
    ...overrides,
  };
}

/** The first message for a field, or undefined if that field had no issue. */
function errorFor(result: ReturnType<typeof expenseInputSchema.safeParse>, field: string) {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("expenseInputSchema — amount", () => {
  it("converts euros to cents so nothing downstream sees euros", () => {
    const result = expenseInputSchema.safeParse(submission());

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amountCents).toBe(4520);
  });

  it("accepts a comma decimal separator", () => {
    const result = expenseInputSchema.safeParse(submission({ amountCents: "12,34" }));

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amountCents).toBe(1234);
  });

  it.each([
    ["empty", ""],
    ["non-numeric", "abc"],
    ["three decimals", "12.345"],
    ["negative", "-5"],
  ])("rejects %s with a readable message, not a type error", (_label, amount) => {
    const result = expenseInputSchema.safeParse(submission({ amountCents: amount }));

    expect(result.success).toBe(false);
    // The point of .transform + .pipe: the user is told what to type, rather
    // than "expected number, received string".
    expect(errorFor(result, "amountCents")).toBe("Enter an amount like 45.20");
  });

  it("rejects zero — an expense of nothing is not an expense", () => {
    const result = expenseInputSchema.safeParse(submission({ amountCents: "0" }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "amountCents")).toBe("Amount must be more than 0");
  });

  it("rejects an implausibly large amount as a fat-finger guard", () => {
    // Via the helper rather than `MAX_AMOUNT_CENTS / 100`: AC-1 says the money
    // module is the only place either unit converts, and a test is not exempt.
    const overLimit = formatAmountInput(MAX_AMOUNT_CENTS + 100);
    const result = expenseInputSchema.safeParse(submission({ amountCents: overLimit }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "amountCents")).toBe("That amount looks too large");
  });

  it("rejects a missing amount field", () => {
    const withoutAmount = { ...submission() };
    delete withoutAmount.amountCents;
    const result = expenseInputSchema.safeParse(withoutAmount);

    expect(result.success).toBe(false);
    expect(errorFor(result, "amountCents")).toBe("Enter an amount like 45.20");
  });
});

describe("expenseInputSchema — date", () => {
  it("accepts a date input's YYYY-MM-DD value", () => {
    const result = expenseInputSchema.safeParse(submission({ date: "2026-08-01" }));

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.date.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("accepts today", () => {
    const today = new Date().toISOString().slice(0, 10);

    expect(expenseInputSchema.safeParse(submission({ date: today })).success).toBe(true);
  });

  it("rejects a date well in the future — an expense records what happened", () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = expenseInputSchema.safeParse(submission({ date: nextWeek }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "date")).toBe("Date cannot be in the future");
  });

  it("tolerates a timezone ahead of the server rather than rejecting 'today'", () => {
    // The cut-off is now + 24h precisely so a user whose local date is already
    // tomorrow is not told the current day is invalid.
    const inTwelveHours = new Date(Date.now() + 12 * 60 * 60 * 1000);

    expect(expenseInputSchema.safeParse(submission({ date: inTwelveHours })).success).toBe(true);
  });

  it("rejects an unparseable date", () => {
    expect(expenseInputSchema.safeParse(submission({ date: "not-a-date" })).success).toBe(false);
  });

  it("rejects a date before 1900", () => {
    const result = expenseInputSchema.safeParse(submission({ date: "1850-01-01" }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "date")).toBe("Date looks too early");
  });
});

describe("expenseInputSchema — identifiers", () => {
  it("requires a category to be chosen", () => {
    const result = expenseInputSchema.safeParse(submission({ categoryId: "" }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "categoryId")).toBe("Choose a category");
  });

  it("requires a car", () => {
    expect(expenseInputSchema.safeParse(submission({ carId: "" })).success).toBe(false);
  });

  it("does not attempt to verify ownership — that is the data layer's job", () => {
    // A well-formed id belonging to someone else parses fine here. The check
    // that matters lives in lib/expenses.ts, which can actually query.
    expect(expenseInputSchema.safeParse(submission({ carId: "someone-elses-car" })).success).toBe(
      true,
    );
  });
});

describe("expenseInputSchema — optional and fuel fields", () => {
  it("stores blank optional text as undefined, not an empty string", () => {
    const result = expenseInputSchema.safeParse(submission({ notes: "  ", station: "" }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeUndefined();
      expect(result.data.station).toBeUndefined();
    }
  });

  it("accepts fuel fields regardless of the chosen category", () => {
    // Not conditional on the category being "Fuel": category names are user
    // data as of 02-07, so branching on the string would break on a rename.
    const result = expenseInputSchema.safeParse(
      submission({
        categoryId: "anything",
        liters: "42.5",
        station: "Test Station",
        fullTank: "on",
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.liters).toBe(42.5);
      expect(result.data.fullTank).toBe(true);
    }
  });

  it("treats an absent checkbox as false", () => {
    const result = expenseInputSchema.safeParse(submission({ fullTank: undefined }));

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullTank).toBe(false);
  });

  it("rejects non-positive litres", () => {
    expect(expenseInputSchema.safeParse(submission({ liters: "0" })).success).toBe(false);
    expect(expenseInputSchema.safeParse(submission({ liters: "-1" })).success).toBe(false);
  });

  it("rejects notes longer than the column allows", () => {
    expect(expenseInputSchema.safeParse(submission({ notes: "x".repeat(501) })).success).toBe(
      false,
    );
  });
});
