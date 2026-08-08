import { describe, expect, it } from "vitest";
import { categoryInputSchema } from "@/lib/validation/category";

describe("categoryInputSchema", () => {
  it("accepts and trims a name", () => {
    const result = categoryInputSchema.safeParse({ name: "  Servicing  " });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Servicing");
  });

  it("rejects an empty or whitespace-only name", () => {
    for (const name of ["", "   "]) {
      const result = categoryInputSchema.safeParse({ name });
      expect(result.success, `expected ${JSON.stringify(name)} to be rejected`).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("Enter a category name");
    }
  });

  it("rejects a missing name with the same message, not a type error", () => {
    const result = categoryInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Enter a category name");
  });

  it("rejects a name longer than the column allows", () => {
    expect(categoryInputSchema.safeParse({ name: "x".repeat(41) }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "x".repeat(40) }).success).toBe(true);
  });

  it("does not attempt to check uniqueness — only the database can", () => {
    // Two identical names both parse. The partial unique indexes are raw SQL,
    // so the conflict is reported at write time by lib/categories.ts.
    expect(categoryInputSchema.safeParse({ name: "Fuel" }).success).toBe(true);
    expect(categoryInputSchema.safeParse({ name: "Fuel" }).success).toBe(true);
  });
});
