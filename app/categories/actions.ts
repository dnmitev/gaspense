"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCategory, deleteCategory, renameCategory } from "@/lib/categories";
import { requireUserId } from "@/lib/session";
import { categoryInputSchema } from "@/lib/validation/category";
import type { CategoryWriteResult } from "@/lib/categories";

/**
 * Server actions for categories.
 *
 * The data layer returns a described refusal rather than throwing, because two
 * of the failures here are ordinary user actions — naming a category something
 * they already used, or deleting one they forgot they had filed expenses under.
 * This module's job is to turn those into sentences.
 */

export type ActionResult =
  { ok: true } | { ok: false; errors: Record<string, string[]>; formError?: string };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }

  return errors;
}

/** Turns a data-layer refusal into something worth reading. */
function describe(result: CategoryWriteResult): ActionResult {
  if (result.ok) return { ok: true };

  switch (result.reason) {
    case "duplicate-name":
      return { ok: false, errors: { name: ["You already have a category with that name"] } };
    case "in-use":
      return {
        ok: false,
        errors: {},
        formError:
          `That category is used by ${result.expenseCount} ` +
          `${result.expenseCount === 1 ? "expense" : "expenses"}. ` +
          `Change those expenses first, then delete it.`,
      };
    // Same message whether the row belongs to someone else or is a system
    // default — confirming which would tell the caller something about a row
    // they cannot see.
    case "not-found":
      return { ok: false, errors: {}, formError: "That category could not be found." };
  }
}

export async function createCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = categoryInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };

  const result = describe(await createCategory(userId, parsed.data));
  if (!result.ok) return result;

  revalidatePath("/categories");
  redirect("/categories");
}

export async function renameCategoryAction(
  categoryId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = categoryInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };

  const result = describe(await renameCategory(userId, categoryId, parsed.data));
  if (!result.ok) return result;

  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!categoryId) return { ok: false, errors: {}, formError: "That category could not be found." };

  const result = describe(await deleteCategory(userId, categoryId));

  revalidatePath("/categories");
  return result;
}
