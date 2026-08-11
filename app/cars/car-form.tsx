"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/app/cars/actions";
import { AttachmentField } from "@/app/cars/[id]/expenses/attachment-field";
import { FUEL_TYPES } from "@/lib/validation/car";

type CarFormValues = {
  licensePlate?: string;
  make?: string | null;
  model?: string | null;
  nickname?: string | null;
  year?: number | null;
  fuelType?: string;
};

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  car?: CarFormValues;
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
      {messages.join(". ")}
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base " +
  "dark:border-neutral-700 dark:bg-neutral-950";

export function CarForm({ action, submitLabel, car }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.ok === false ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.ok === false && state.formError ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="licensePlate" className="text-sm font-medium">
          Licence plate
        </label>
        <input
          id="licensePlate"
          name="licensePlate"
          required
          defaultValue={car?.licensePlate ?? ""}
          className={inputClass}
          autoCapitalize="characters"
        />
        <FieldError messages={errors.licensePlate} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="nickname" className="text-sm font-medium">
          Nickname <span className="text-neutral-500">(optional)</span>
        </label>
        <input
          id="nickname"
          name="nickname"
          defaultValue={car?.nickname ?? ""}
          className={inputClass}
        />
        <FieldError messages={errors.nickname} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="make" className="text-sm font-medium">
          Make <span className="text-neutral-500">(optional)</span>
        </label>
        <input id="make" name="make" defaultValue={car?.make ?? ""} className={inputClass} />
        <FieldError messages={errors.make} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="model" className="text-sm font-medium">
          Model <span className="text-neutral-500">(optional)</span>
        </label>
        <input id="model" name="model" defaultValue={car?.model ?? ""} className={inputClass} />
        <FieldError messages={errors.model} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="year" className="text-sm font-medium">
          Year <span className="text-neutral-500">(optional)</span>
        </label>
        <input
          id="year"
          name="year"
          type="number"
          inputMode="numeric"
          defaultValue={car?.year ?? ""}
          className={inputClass}
        />
        <FieldError messages={errors.year} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fuelType" className="text-sm font-medium">
          Fuel type
        </label>
        <select
          id="fuelType"
          name="fuelType"
          defaultValue={car?.fuelType ?? "PETROL"}
          className={inputClass}
        >
          {FUEL_TYPES.map((fuel) => (
            <option key={fuel} value={fuel}>
              {fuel.charAt(0) + fuel.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <FieldError messages={errors.fuelType} />
      </div>

      {/* The same field the expense form uses — one upload path, one
          downscaler, one set of validations. A second copy would be a second
          place to forget one of them. */}
      <AttachmentField />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/cars" className="text-sm underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
