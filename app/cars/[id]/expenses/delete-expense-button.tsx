"use client";

import { deleteExpenseAction } from "@/app/cars/[id]/expenses/actions";

/**
 * Unlike a car, an expense hard-deletes — so the confirmation says the record
 * is removed, with no promise that anything is kept. Saying otherwise would be
 * false, which is the same reason the car button says the opposite.
 */
export function DeleteExpenseButton({
  expenseId,
  carId,
  label,
}: {
  expenseId: string;
  carId: string;
  label: string;
}) {
  return (
    <form action={deleteExpenseAction} className="inline">
      <input type="hidden" name="expenseId" value={expenseId} />
      <input type="hidden" name="carId" value={carId} />
      <button
        type="submit"
        className="text-sm text-red-600 underline dark:text-red-400"
        onClick={(event) => {
          const ok = window.confirm(`Delete ${label}?\n\nThis cannot be undone.`);
          if (!ok) event.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
