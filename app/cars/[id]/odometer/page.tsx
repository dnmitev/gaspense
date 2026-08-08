import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteReadingButton } from "@/app/cars/[id]/odometer/delete-reading-button";
import { getCarById } from "@/lib/cars";
import { listReadingsForCar } from "@/lib/odometer";
import { getCurrentUserId } from "@/lib/session";

/** Fixed locale: the server's default would make output depend on the machine. */
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const kmFormat = new Intl.NumberFormat("en-GB");

export default async function OdometerPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id } = await params;

  const car = await getCarById(userId, id);
  if (!car) notFound();

  const readings = await listReadingsForCar(userId, car.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/expenses`} className="text-sm underline">
          ← {car.nickname ?? car.licensePlate}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Odometer</h1>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">Latest reading</span>
          <span className="text-2xl font-semibold tabular-nums">
            {readings[0] ? `${kmFormat.format(readings[0].reading)} km` : "—"}
          </span>
        </div>
        <Link
          href={`/cars/${car.id}/odometer/new`}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Add reading
        </Link>
      </div>

      {readings.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          No readings yet. Add one, or record the odometer when you log a fill-up.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {readings.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold tabular-nums">
                  {kmFormat.format(entry.reading)} km
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dateFormat.format(entry.date)}
                </span>
              </div>

              {/*
                Readings captured with a fill-up are labelled. Without this, a
                user sees entries they do not remember typing and has no way to
                tell where they came from.
              */}
              {entry.source === "EXPENSE" ? (
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Recorded with a fill-up
                </span>
              ) : null}

              <div className="flex items-center gap-4">
                <Link
                  href={`/cars/${car.id}/odometer/${entry.id}/edit`}
                  className="text-sm underline"
                >
                  Edit
                </Link>
                <DeleteReadingButton
                  readingId={entry.id}
                  carId={car.id}
                  label={`${kmFormat.format(entry.reading)} km`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
