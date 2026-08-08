"use client";

import { useActionState } from "react";
import { deleteCategoryAction } from "@/app/categories/actions";

/**
 * Uses `useActionState` rather than a plain form action because deletion can be
 * *refused* — a category with expenses filed under it stays put, and the reason
 * has to land somewhere the user will read it.
 */
export function DeleteCategoryButton({ categoryId, name }: { categoryId: string; name: string }) {
  const [state, formAction, pending] = useActionState(deleteCategoryAction, null);

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="inline">
        <input type="hidden" name="categoryId" value={categoryId} />
        <button
          type="submit"
          disabled={pending}
          className="text-sm text-red-600 underline disabled:opacity-60 dark:text-red-400"
          onClick={(event) => {
            if (!window.confirm(`Delete the category "${name}"?`)) event.preventDefault();
          }}
        >
          Delete
        </button>
      </form>

      {state?.ok === false && state.formError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}
