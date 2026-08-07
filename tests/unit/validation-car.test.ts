import { describe, expect, it } from "vitest";
import { FUEL_TYPES, carInputSchema } from "@/lib/validation/car";

const valid = { licensePlate: "TEST-0001", fuelType: "PETROL" as const };

describe("licence plate", () => {
  // The plate field deliberately has no format regex. These cases are the
  // reason: all are real registration formats, and a pattern guessing the
  // Bulgarian shape would reject most of them.
  it.each([
    ["Bulgarian with spaces", "CB 1234 AB"],
    ["Bulgarian compact", "CB1234AB"],
    ["Dutch style", "AB-123-CD"],
    ["US style", "7ABC123"],
    ["German style", "M AB 1234"],
    ["short vanity", "GAS"],
  ])("accepts a %s plate", (_label, plate) => {
    const result = carInputSchema.safeParse({ ...valid, licensePlate: plate });
    expect(result.success).toBe(true);
  });

  it("uppercases the plate so casing does not create duplicates", () => {
    const result = carInputSchema.parse({ ...valid, licensePlate: " cb1234ab " });
    expect(result.licensePlate).toBe("CB1234AB");
  });

  it("rejects a blank plate", () => {
    const result = carInputSchema.safeParse({ ...valid, licensePlate: "   " });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("licensePlate");
  });

  it("rejects an absurdly long plate", () => {
    const result = carInputSchema.safeParse({ ...valid, licensePlate: "A".repeat(21) });
    expect(result.success).toBe(false);
  });
});

describe("optional text fields", () => {
  it("turns blank strings into undefined rather than storing empty text", () => {
    const result = carInputSchema.parse({
      ...valid,
      make: "",
      model: "   ",
      nickname: "",
    });

    expect(result.make).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.nickname).toBeUndefined();
  });

  it("trims values that are present", () => {
    const result = carInputSchema.parse({ ...valid, make: "  Testla  " });
    expect(result.make).toBe("Testla");
  });

  it("rejects over-long values", () => {
    expect(carInputSchema.safeParse({ ...valid, make: "x".repeat(61) }).success).toBe(false);
  });
});

describe("year", () => {
  it("accepts a plausible year and coerces a numeric string", () => {
    expect(carInputSchema.parse({ ...valid, year: "2019" }).year).toBe(2019);
  });

  it("treats a blank year as absent", () => {
    expect(carInputSchema.parse({ ...valid, year: "" }).year).toBeUndefined();
  });

  it("rejects an implausibly early year", () => {
    expect(carInputSchema.safeParse({ ...valid, year: 1800 }).success).toBe(false);
  });

  it("rejects a year beyond next year, computed at runtime", () => {
    const tooLate = new Date().getFullYear() + 2;
    expect(carInputSchema.safeParse({ ...valid, year: tooLate }).success).toBe(false);
  });

  it("accepts next year, since models ship ahead of the calendar", () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(carInputSchema.safeParse({ ...valid, year: nextYear }).success).toBe(true);
  });

  it("rejects a fractional year", () => {
    expect(carInputSchema.safeParse({ ...valid, year: 2019.5 }).success).toBe(false);
  });
});

describe("fuel type", () => {
  it("accepts every value the Prisma enum defines", () => {
    for (const fuelType of FUEL_TYPES) {
      expect(carInputSchema.safeParse({ ...valid, fuelType }).success).toBe(true);
    }
  });

  it("exposes the full enum to the form", () => {
    // Guards against the form and the database drifting apart.
    expect(FUEL_TYPES).toEqual(["PETROL", "DIESEL", "LPG", "ELECTRIC", "HYBRID", "OTHER"]);
  });

  it("rejects a value outside the enum", () => {
    expect(carInputSchema.safeParse({ ...valid, fuelType: "COAL" }).success).toBe(false);
  });
});
