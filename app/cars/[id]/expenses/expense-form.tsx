"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/app/cars/[id]/expenses/actions";

type CategoryOption = { id: string; name: string };

type ExpenseFormValues = {
  categoryId?: string;
  /** Already formatted for an input — never raw cents. See `formatAmountInput`. */
  amount?: string;
  date?: string;
  notes?: string | null;
  liters?: number | null;
  station?: string | null;
  fullTank?: boolean | null;
  odometer?: number | null;
};

type CarOption = { id: string; label: string };

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  carId: string;
  categories: CategoryOption[];
  /**
   * Supplied only by the car-agnostic route, which does not know the car yet.
   *
   * Given cars, the form renders a `<select name="carId">` as its first field.
   * Given none, it keeps the hidden input — the per-car routes are unchanged.
   *
   * Either way `carId` is untrusted input that `createExpense` verifies against
   * the database, which is exactly why offering a select is safe. Proven in
   * tests/integration/quick-add.test.ts rather than assumed.
   */
  cars?: CarOption[];
  /** Where Cancel goes. Defaults to the car's expense list, which has no analogue on the quick-add route. */
  cancelHref?: string;
  /** Focus the amount field on arrival. On for quick-add; off when editing, where it would fight the browser's scroll restoration. */
  focusAmount?: boolean;
  expense?: ExpenseFormValues;
  /**
   * Fuel entry shows the fuel fields outright; other entry tucks the same
   * fields into a collapsed disclosure. They are never omitted — an expense
   * that turns out to have litres must still be editable.
   */
  showFuelFields?: boolean;
  /** Preselected category, used to default fuel entry to the Fuel category. */
  defaultCategoryId?: string;
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

/** Today as YYYY-MM-DD in the *browser's* timezone, which is what the user means. */
function today(): string {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  return new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/**
 * Renders its children bare when `open`, or inside a collapsed disclosure when
 * not. `<details>` is native: keyboard-accessible and functional without JS,
 * which matters because the rest of this form works without client JS too.
 */
function FuelDetails({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (open) return <>{children}</>;

  return (
    // No border here: the child fieldset draws its own once opened.
    <details className="flex flex-col gap-2">
      <summary className="cursor-pointer py-1 text-sm font-medium underline">
        Add fuel details
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

export function ExpenseForm({
  action,
  submitLabel,
  carId,
  categories,
  cars,
  cancelHref,
  focusAmount = false,
  expense,
  showFuelFields = false,
  defaultCategoryId,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.ok === false ? state.errors : {};
  const backHref = cancelHref ?? `/cars/${carId}/expenses`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {cars?.length ? (
        // First field on purpose: the car is the thing you would notice being
        // wrong, and burying it under the amount invites filing a fill-up
        // against the wrong vehicle.
        <div className="flex flex-col gap-1">
          <label htmlFor="carId" className="text-sm font-medium">
            Car
          </label>
          <select id="carId" name="carId" required defaultValue={carId} className={inputClass}>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.label}
              </option>
            ))}
          </select>
          <FieldError messages={errors.carId} />
        </div>
      ) : (
        /* Untrusted like every other field — the data layer verifies ownership. */
        <input type="hidden" name="carId" value={carId} />
      )}

      {state?.ok === false && state.formError ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium">
          Amount (€)
        </label>
        {/*
          inputMode="decimal" opens the numeric keypad on a phone — this is a
          mobile-first app and the amount is the field people type most.
          Deliberately type="text": type="number" would let the browser's own
          locale rules reject or reformat "12,34" before the schema ever sees it.
        */}
        {/*
          autoFocus is most of what "adding an expense takes seconds" means on a
          phone: the numeric keypad is already up and the amount is the reason
          the page was opened. Off when editing, where it would fight scroll
          restoration and move focus away from whatever the user came to change.
        */}
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          autoFocus={focusAmount}
          placeholder="45.20"
          defaultValue={expense?.amount ?? ""}
          className={inputClass}
        />
        <FieldError messages={errors.amountCents} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="text-sm font-medium">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue={expense?.categoryId ?? defaultCategoryId ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <FieldError messages={errors.categoryId} />
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
          defaultValue={expense?.date ?? today()}
          className={inputClass}
        />
        <FieldError messages={errors.date} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes <span className="text-neutral-500">(optional)</span>
        </label>
        <input id="notes" name="notes" defaultValue={expense?.notes ?? ""} className={inputClass} />
        <FieldError messages={errors.notes} />
      </div>

      {/*
        Which fields are VISIBLE depends on the entry point the user chose, not
        on the selected category. Category names are user-editable from 02-07,
        so keying the UI off the string "Fuel" would break on a rename; the
        chosen entry point is a decision the user just made and cannot go stale.
        Validation stays unconditional — the schema accepts fuel fields for any
        category.
      */}
      <FuelDetails open={showFuelFields}>
        <fieldset className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">Fuel details (optional)</legend>

          <div className="flex flex-col gap-1">
            <label htmlFor="liters" className="text-sm font-medium">
              Litres
            </label>
            <input
              id="liters"
              name="liters"
              type="text"
              inputMode="decimal"
              defaultValue={expense?.liters ?? ""}
              className={inputClass}
            />
            <FieldError messages={errors.liters} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="station" className="text-sm font-medium">
              Station
            </label>
            <input
              id="station"
              name="station"
              defaultValue={expense?.station ?? ""}
              className={inputClass}
            />
            <FieldError messages={errors.station} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="odometer" className="text-sm font-medium">
              Odometer (km)
            </label>
            {/*
              Captured at the fill-up because that is the one moment the number
              is actually in front of the driver. It becomes a reading in the
              car's odometer log, linked to this expense — clearing it here
              removes that reading.
            */}
            <input
              id="odometer"
              name="odometer"
              type="text"
              inputMode="numeric"
              defaultValue={expense?.odometer ?? ""}
              className={inputClass}
            />
            <FieldError messages={errors.odometer} />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="fullTank"
              name="fullTank"
              type="checkbox"
              defaultChecked={expense?.fullTank ?? false}
              className="size-4"
            />
            <label htmlFor="fullTank" className="text-sm font-medium">
              Full tank
            </label>
          </div>
        </fieldset>
      </FuelDetails>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={backHref} className="text-sm underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
