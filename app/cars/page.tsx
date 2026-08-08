import Link from "next/link";
import { DeleteCarButton } from "@/app/cars/delete-car-button";
import { listActiveCars } from "@/lib/cars";
import { getCurrentUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function CarsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const cars = await listActiveCars(userId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your cars</h1>
          <Link href="/categories" className="text-sm underline">
            Manage categories
          </Link>
        </div>
        <Link
          href="/cars/new"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Add car
        </Link>
      </header>

      {cars.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          No cars yet. Add your first one to start tracking its costs.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cars.map((car) => (
            <li
              key={car.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-col">
                <span className="font-mono text-lg font-semibold">{car.licensePlate}</span>
                {car.nickname ? (
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {car.nickname}
                  </span>
                ) : null}
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {[car.make, car.model, car.year].filter(Boolean).join(" · ") || "No details yet"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <Link href={`/cars/${car.id}/expenses`} className="text-sm underline">
                  Expenses
                </Link>
                <Link href={`/cars/${car.id}/edit`} className="text-sm underline">
                  Edit
                </Link>
                <DeleteCarButton carId={car.id} label={car.nickname ?? car.licensePlate} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
