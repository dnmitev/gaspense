import { z } from "zod";

/**
 * Validation for a category name.
 *
 * Uniqueness is deliberately NOT checked here. It cannot be: the constraint
 * lives in two raw-SQL partial indexes (see the 02-03 migration), so only the
 * database can answer it. `lib/categories.ts` catches the violation and reports
 * it as a field error.
 */

export const categoryInputSchema = z.object({
  name: z
    .string({ error: "Enter a category name" })
    .trim()
    .min(1, "Enter a category name")
    .max(40, "Category name is too long"),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
