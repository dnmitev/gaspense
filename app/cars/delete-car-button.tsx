"use client";

import { deleteCarAction } from "@/app/cars/actions";

/**
 * Deletion is a soft delete: the car leaves this list but its expense history
 * is kept. The confirmation text says exactly that — claiming the data is
 * permanently removed would be false.
 */
export function DeleteCarButton({ carId, label }: { carId: string; label: string }) {
  return (
    <form action={deleteCarAction} className="inline">
      <input type="hidden" name="carId" value={carId} />
      <button
        type="submit"
        className="text-sm text-red-600 underline dark:text-red-400"
        onClick={(event) => {
          const ok = window.confirm(
            `Remove ${label} from your cars?\n\nIts expense history will be kept.`,
          );
          if (!ok) event.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
