"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attachPostedPhoto } from "@/lib/attach-posted-photo";
import { createAttachmentForExpense, deleteAttachment } from "@/lib/attachments";
import { createExpense, deleteExpense, updateExpense } from "@/lib/expenses";
import { requireUserId } from "@/lib/session";
import { expenseInputSchema } from "@/lib/validation/expense";

/**
 * Server actions for expenses.
 *
 * Same contract as `app/cars/actions.ts`: every action starts with
 * `requireUserId()`, which throws when there is no session, and the id then
 * travels explicitly into `lib/expenses.ts` where it lands in the query.
 *
 * `carId` arrives from the form rather than the URL. That is safe only because
 * `createExpense`/`updateExpense` verify ownership of it in the database — the
 * form field is untrusted input like any other.
 *
 * Return values cross the server/client boundary, so they stay plain
 * serialisable objects — no Error instances, no Zod error classes.
 */

export type ActionResult =
  { ok: true } | { ok: false; errors: Record<string, string[]>; formError?: string };

function parseForm(formData: FormData) {
  return expenseInputSchema.safeParse({
    carId: formData.get("carId"),
    categoryId: formData.get("categoryId"),
    // The form posts euros; the schema converts to cents. Nothing between here
    // and the database sees a euro value.
    amountCents: formData.get("amount"),
    date: formData.get("date"),
    notes: formData.get("notes"),
    liters: formData.get("liters"),
    station: formData.get("station"),
    fullTank: formData.get("fullTank"),
    odometer: formData.get("odometer"),
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

/** The list the user came from. Also what `revalidatePath` must invalidate. */
const expensesPath = (carId: string) => `/cars/${carId}/expenses`;

export async function createExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error.issues) };
  }

  const created = await createExpense(userId, parsed.data);

  // Null means the car or the category is not this user's to use. Reported
  // identically either way — saying which would confirm that the other exists.
  if (!created) {
    return { ok: false, errors: {}, formError: "That car or category could not be found." };
  }

  const attachmentError = await attachPostedPhoto(formData, (input, bytes) =>
    createAttachmentForExpense(userId, created.id, input, bytes),
  );
  if (attachmentError) {
    // The expense IS saved. Say so, rather than reporting a bare failure that
    // invites the user to submit it a second time and end up with two.
    return {
      ok: false,
      errors: {},
      formError: `${attachmentError} The expense itself was saved.`,
    };
  }

  revalidatePath(expensesPath(parsed.data.carId));
  redirect(expensesPath(parsed.data.carId));
}

export async function updateExpenseAction(
  expenseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error.issues) };
  }

  const updated = await updateExpense(userId, expenseId, parsed.data);

  if (updated === 0) {
    return { ok: false, errors: {}, formError: "That expense could not be found." };
  }

  const attachmentError = await attachPostedPhoto(formData, (input, bytes) =>
    createAttachmentForExpense(userId, expenseId, input, bytes),
  );
  if (attachmentError) {
    return { ok: false, errors: {}, formError: `${attachmentError} The changes were saved.` };
  }

  revalidatePath(expensesPath(parsed.data.carId));
  redirect(expensesPath(parsed.data.carId));
}

/**
 * Removes a photo. Scoped like every other action: the id travels into
 * `lib/attachments.ts`, where it lands in the same query as the ownership
 * filter, so someone else's attachment matches zero rows.
 */
export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const carId = String(formData.get("carId") ?? "");

  if (attachmentId) await deleteAttachment(userId, attachmentId);

  if (carId) revalidatePath(expensesPath(carId));
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const expenseId = String(formData.get("expenseId") ?? "");
  const carId = String(formData.get("carId") ?? "");

  if (expenseId) {
    // Hard delete: an expense is the history, so removing one is a correction.
    await deleteExpense(userId, expenseId);
  }

  if (carId) revalidatePath(expensesPath(carId));
}
