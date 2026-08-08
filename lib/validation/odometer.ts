import { z } from "zod";
import { recordedDate } from "@/lib/validation/shared";

/**
 * Validation for an odometer reading.
 *
 * Deliberately does NOT require readings to increase over time. It is tempting
 * — a decreasing series looks like a typo — but odometers are replaced,
 * corrected after a repair, and very occasionally roll over, and a hard rule
 * would block legitimate entry with no way around it. Phase 3 must cope with an
 * out-of-order series when computing consumption; that is the right place for
 * the problem, because there it can be reported rather than enforced.
 */

/** ~2 million km. A fat-finger guard, not a real ceiling. */
export const MAX_READING_KM = 2_000_000;

export const odometerInputSchema = z.object({
  carId: z.string().trim().min(1, "Car is required"),

  date: recordedDate,

  reading: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
      .number({ error: "Enter the odometer reading in km" })
      .int("Reading must be a whole number of kilometres")
      .positive("Reading must be more than 0")
      .max(MAX_READING_KM, "That reading looks too large"),
  ),
});

export type OdometerInput = z.infer<typeof odometerInputSchema>;
