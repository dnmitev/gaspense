"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/app/categories/actions";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  name?: string;
  showCancel?: boolean;
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base " +
  "dark:border-neutral-700 dark:bg-neutral-950";

export function CategoryForm({ action, submitLabel, name, showCancel = false }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.ok === false ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Category name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={name ?? ""}
          placeholder="e.g. Servicing"
          className={inputClass}
        />
        {errors.name?.length ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.name.join(". ")}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {showCancel ? (
          <Link href="/categories" className="text-sm underline">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}
