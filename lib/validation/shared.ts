import { z } from "zod";

/**
 * Helpers shared by the validation schemas.
 *
 * `optionalText` began life inside `lib/validation/car.ts`. It is duplicated
 * there rather than imported: plan 02-06 lists that file as boundary-protected,
 * so this module exists for the new schemas and `car.ts` keeps its own copy
 * until a plan is allowed to touch it. 02-07 adds two more schemas and should
 * consolidate all three onto this one.
 */

/**
 * Trimmed optional text with a maximum length.
 *
 * Blank form fields arrive as `""`. Storing `undefined` instead means the
 * optional column holds NULL rather than an empty string, so "not provided" and
 * "provided as empty" do not become two different states in the database.
 */
export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
