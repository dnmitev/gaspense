import { z } from "zod";
import { parseAmountToCents } from "@/lib/money";
import { MAX_READING_KM } from "@/lib/validation/odometer";
import { optionalText, recordedDate } from "@/lib/validation/shared";

/**
 * Validation for an expense as submitted by a form.
 *
 * `carId` and `categoryId` are checked for shape only. Whether they belong to
 * the caller is a database question, and a schema cannot see the database —
 * ownership is enforced in `lib/expenses.ts`. Keeping that boundary explicit
 * matters: a schema that looked like it validated ownership would be a very
 * comfortable place to stop thinking about it.
 */

/** €1,000,000. Not a real limit, a fat-finger guard — "4520" typed into euros. */
export const MAX_AMOUNT_CENTS = 100_000_000;

const id = (message: string) => z.string().trim().min(1, message);

/**
 * The raw amount string becomes cents here, so nothing downstream ever sees
 * euros. `.transform` + `.pipe` rather than `z.preprocess`: a failed parse must
 * produce "Enter an amount like 45.20" rather than Zod's
 * "expected number, received string", which tells the user nothing.
 */
const amountCents = z
  .string({ error: "Enter an amount like 45.20" })
  .transform((value, ctx) => {
    const cents = parseAmountToCents(value);

    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 45.20" });
      return z.NEVER;
    }

    return cents;
  })
  .pipe(
    z
      .number()
      .int()
      .positive("Amount must be more than 0")
      .max(MAX_AMOUNT_CENTS, "That amount looks too large"),
  );

export const expenseInputSchema = z.object({
  carId: id("Car is required"),
  categoryId: id("Choose a category"),

  amountCents,
  date: recordedDate,

  notes: optionalText(500),

  // Fuel-specific, all optional.
  //
  // Deliberately NOT conditional on the category being "Fuel". Category names
  // are user data — 02-07 lets people rename and add their own — so a schema
  // branching on the string "Fuel" would break the moment someone renames it or
  // adds "Diesel". The form decides when to show these; the schema accepts them.
  liters: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().positive("Litres must be more than 0").optional(),
  ),
  station: optionalText(60),
  fullTank: z.preprocess((value) => value === "on" || value === true, z.boolean()),

  /**
   * The odometer at the moment of the fill-up. Optional: blank means "not
   * recorded", which is different from zero and must not become a reading.
   *
   * Captured here rather than only in the standalone log because a fill-up is
   * the one moment the driver reliably has the number in front of them — and
   * without it there is no distance between fills, so no consumption figure.
   */
  odometer: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
      .number()
      .int("Reading must be a whole number of kilometres")
      .positive("Reading must be more than 0")
      .max(MAX_READING_KM, "That reading looks too large")
      .optional(),
  ),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
