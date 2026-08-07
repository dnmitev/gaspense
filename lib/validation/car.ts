import { z } from "zod";
import { FuelType } from "@/lib/generated/prisma/enums";

// Blank form fields arrive as "" — store `undefined` instead, so an optional
// column holds NULL rather than an empty string.
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

// Derived at runtime rather than hardcoded: a literal year would silently start
// rejecting next year's models.
const MAX_MODEL_YEAR = new Date().getFullYear() + 1;

export const carInputSchema = z.object({
  /**
   * Deliberately NOT format-validated.
   *
   * The owner may add a car registered anywhere, and plate formats vary wildly
   * ("CB 1234 AB", "AB-123-CD", "7ABC123"). A regex guessing the Bulgarian
   * pattern would reject valid input, which is a worse failure than accepting a
   * typo the user can see and fix.
   *
   * Uppercased so "cb1234ab" and "CB1234AB" do not become two different cars.
   */
  licensePlate: z
    .string()
    .trim()
    .min(1, "Licence plate is required")
    .max(20, "Licence plate is too long")
    .transform((value) => value.toUpperCase()),

  make: optionalText(60),
  model: optionalText(60),
  nickname: optionalText(60),

  year: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
      .number()
      .int("Year must be a whole number")
      .min(1900, "Year looks too early")
      .max(MAX_MODEL_YEAR, `Year cannot be later than ${MAX_MODEL_YEAR}`)
      .optional(),
  ),

  // Sourced from the Prisma enum rather than retyped, so adding a fuel type to
  // the schema cannot desynchronise validation from the database.
  fuelType: z.enum(FuelType),
});

export type CarInput = z.infer<typeof carInputSchema>;

/** The fuel types a form should offer, in schema order. */
export const FUEL_TYPES = Object.values(FuelType);
