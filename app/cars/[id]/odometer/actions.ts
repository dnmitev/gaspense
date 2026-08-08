"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createReading, deleteReading, updateReading } from "@/lib/odometer";
import { requireUserId } from "@/lib/session";
import { odometerInputSchema } from "@/lib/validation/odometer";

/** Server actions for odometer readings. Same contract as the expense actions. */

export type ActionResult =
  { ok: true } | { ok: false; errors: Record<string, string[]>; formError?: string };

function parseForm(formData: FormData) {
  return odometerInputSchema.safeParse({
    carId: formData.get("carId"),
    date: formData.get("date"),
    reading: formData.get("reading"),
  });
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }

  return errors;
}

const odometerPath = (carId: string) => `/cars/${carId}/odometer`;

export async function createReadingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };

  // Null means the car is not this user's. Reported as "not found" without
  // confirming whether it exists.
  if (!(await createReading(userId, parsed.data))) {
    return { ok: false, errors: {}, formError: "That car could not be found." };
  }

  revalidatePath(odometerPath(parsed.data.carId));
  redirect(odometerPath(parsed.data.carId));
}

export async function updateReadingAction(
  readingId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };

  if ((await updateReading(userId, readingId, parsed.data)) === 0) {
    return { ok: false, errors: {}, formError: "That reading could not be found." };
  }

  revalidatePath(odometerPath(parsed.data.carId));
  redirect(odometerPath(parsed.data.carId));
}

export async function deleteReadingAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const readingId = String(formData.get("readingId") ?? "");
  const carId = String(formData.get("carId") ?? "");

  if (readingId) await deleteReading(userId, readingId);
  if (carId) revalidatePath(odometerPath(carId));
}
