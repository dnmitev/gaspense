"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCar, softDeleteCar, updateCar } from "@/lib/cars";
import { requireUserId } from "@/lib/session";
import { carInputSchema } from "@/lib/validation/car";

/**
 * Server actions for cars.
 *
 * Every action starts with `requireUserId()`, which throws when there is no
 * session — so no write can happen unauthenticated. The user id then travels
 * explicitly into `lib/cars.ts`, where it lands in the query's WHERE clause.
 *
 * Return values cross the server/client boundary, so they must stay plain
 * serialisable objects — no Error instances, no Zod error classes.
 */

export type ActionResult =
  { ok: true } | { ok: false; errors: Record<string, string[]>; formError?: string };

function parseForm(formData: FormData) {
  return carInputSchema.safeParse({
    licensePlate: formData.get("licensePlate"),
    make: formData.get("make"),
    model: formData.get("model"),
    nickname: formData.get("nickname"),
    year: formData.get("year"),
    fuelType: formData.get("fuelType"),
  });
}

/** Flattens Zod issues into a plain, serialisable field→messages map. */
function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }

  return errors;
}

export async function createCarAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error.issues) };
  }

  await createCar(userId, parsed.data);

  revalidatePath("/cars");
  redirect("/cars");
}

export async function updateCarAction(
  carId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error.issues) };
  }

  const updated = await updateCar(userId, carId, parsed.data);

  // Zero rows means the car is not this user's, or no longer exists. Reported
  // identically either way — confirming existence would leak whose it is.
  if (updated === 0) {
    return { ok: false, errors: {}, formError: "That car could not be found." };
  }

  revalidatePath("/cars");
  redirect("/cars");
}

export async function deleteCarAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const carId = String(formData.get("carId") ?? "");

  if (carId) {
    // Soft delete: the car leaves the list, its expense history stays.
    await softDeleteCar(userId, carId);
  }

  revalidatePath("/cars");
}
