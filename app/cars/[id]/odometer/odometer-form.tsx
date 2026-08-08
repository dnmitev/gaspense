"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/app/cars/[id]/odometer/actions";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  carId: string;
  reading?: { date: string; reading: number };
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base " +
  "dark:border-neutral-700 dark:bg-neutral-950";

/** Today as YYYY-MM-DD in the browser's timezone, which is what the user means. */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
      {messages.join(". ")}
    </p>
  );
}

export function OdometerForm({ action, submitLabel, carId, reading }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.ok === false ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="carId" value={carId} />

      {state?.ok === false && state.formError ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="reading" className="text-sm font-medium">
          Odometer (km)
        </label>
        <input
          id="reading"
          name="reading"
          type="text"
          inputMode="numeric"
          required
          placeholder="120000"
          defaultValue={reading?.reading ?? ""}
          className={inputClass}
        />
        <FieldError messages={errors.reading} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={reading?.date ?? today()}
          className={inputClass}
        />
        <FieldError messages={errors.date} />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={`/cars/${carId}/odometer`} className="text-sm underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
