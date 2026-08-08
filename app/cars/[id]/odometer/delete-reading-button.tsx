"use client";

import { deleteReadingAction } from "@/app/cars/[id]/odometer/actions";

export function DeleteReadingButton({
  readingId,
  carId,
  label,
}: {
  readingId: string;
  carId: string;
  label: string;
}) {
  return (
    <form action={deleteReadingAction} className="inline">
      <input type="hidden" name="readingId" value={readingId} />
      <input type="hidden" name="carId" value={carId} />
      <button
        type="submit"
        className="text-sm text-red-600 underline dark:text-red-400"
        onClick={(event) => {
          if (!window.confirm(`Delete the reading ${label}?`)) event.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
