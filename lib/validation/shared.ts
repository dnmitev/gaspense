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

const DAY_MS = 24 * 60 * 60 * 1000;
const EARLIEST_DATE = new Date("1900-01-01T00:00:00.000Z");

/**
 * A date the user is recording after the fact — an expense, an odometer reading.
 *
 * Compared per-parse rather than against a module-load constant: a long-running
 * server would otherwise keep enforcing the boundary from whenever it booted.
 *
 * The future cut-off is 24 hours rather than "after today" so a user in a
 * timezone ahead of the server is never told that today is invalid.
 *
 * Shared deliberately. Two schemas quietly disagreeing about what counts as a
 * valid date would be worse than either rule on its own.
 */
export const recordedDate = z.coerce
  .date({ error: "Enter a valid date" })
  .min(EARLIEST_DATE, "Date looks too early")
  .refine((value) => value.getTime() <= Date.now() + DAY_MS, {
    message: "Date cannot be in the future",
  });
