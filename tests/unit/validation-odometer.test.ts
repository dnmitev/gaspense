import { describe, expect, it } from "vitest";
import { MAX_READING_KM, odometerInputSchema } from "@/lib/validation/odometer";

function submission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { carId: "car_1", date: "2026-08-01", reading: "120000", ...overrides };
}

function errorFor(result: ReturnType<typeof odometerInputSchema.safeParse>, field: string) {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("odometerInputSchema", () => {
  it("coerces the reading to a whole number of kilometres", () => {
    const result = odometerInputSchema.safeParse(submission());

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reading).toBe(120000);
  });

  it("rejects a fractional reading", () => {
    const result = odometerInputSchema.safeParse(submission({ reading: "120000.5" }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "reading")).toBe("Reading must be a whole number of kilometres");
  });

  it("rejects zero, negative, and non-numeric readings", () => {
    for (const reading of ["0", "-5", "abc", ""]) {
      expect(
        odometerInputSchema.safeParse(submission({ reading })).success,
        `expected ${JSON.stringify(reading)} to be rejected`,
      ).toBe(false);
    }
  });

  it("rejects an implausibly large reading", () => {
    const result = odometerInputSchema.safeParse(submission({ reading: MAX_READING_KM + 1 }));

    expect(result.success).toBe(false);
    expect(errorFor(result, "reading")).toBe("That reading looks too large");
  });

  it("shares the expense date rule rather than defining its own", () => {
    // Same messages, because both come from lib/validation/shared.ts. If these
    // ever diverge, two forms are disagreeing about what a valid date is.
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    expect(errorFor(odometerInputSchema.safeParse(submission({ date: future })), "date")).toBe(
      "Date cannot be in the future",
    );
    expect(
      errorFor(odometerInputSchema.safeParse(submission({ date: "1850-01-01" })), "date"),
    ).toBe("Date looks too early");
    expect(odometerInputSchema.safeParse(submission({ date: "not-a-date" })).success).toBe(false);
  });

  it("does NOT require readings to increase — odometers get replaced", () => {
    // A deliberate non-rule. Enforcing monotonicity would block a legitimate
    // entry after a cluster replacement, with no way for the user around it.
    expect(odometerInputSchema.safeParse(submission({ reading: "1" })).success).toBe(true);
    expect(odometerInputSchema.safeParse(submission({ reading: "999999" })).success).toBe(true);
  });

  it("requires a car", () => {
    expect(odometerInputSchema.safeParse(submission({ carId: "" })).success).toBe(false);
  });
});
