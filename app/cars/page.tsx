import Link from "next/link";
import { checkVignetteAction } from "@/app/cars/actions";
import { DeleteCarButton } from "@/app/cars/delete-car-button";
import { listActiveCars } from "@/lib/cars";
import { getCurrentUserId } from "@/lib/session";
import {
  getCarVignetteStatuses,
  vignetteCooldownRemaining,
  type CarVignetteStatus,
} from "@/lib/vignette-checks";
import { redirect } from "next/navigation";

/** Day-precision is all a vignette expiry needs; the service sends a naive datetime. */
const asDate = (value: Date) => value.toISOString().slice(0, 10);

/** Minutes, rounded up — a figure someone can act on. */
const minutesFrom = (milliseconds: number) => Math.ceil(milliseconds / 60_000);

/** Remaining cooldown for a car, from its last attempt of any kind. */
const cooldownFor = (status: CarVignetteStatus | undefined) =>
  vignetteCooldownRemaining(status?.lastAttemptAt ?? null, new Date());

/**
 * The vignette line for one car.
 *
 * ⚠️ Four states, and the fourth is the one that matters: "could not check" must
 * never read as "no vignette". A wrong label here tells someone their vignette
 * expired when it has not.
 */
function VignetteLine({ status }: { status: CarVignetteStatus | undefined }) {
  const muted = "text-sm text-neutral-700 dark:text-neutral-300";

  if (!status || (!status.latestResult && !status.lastAttemptAt)) {
    return <span className={muted}>Bulgarian vignette: not checked yet</span>;
  }

  // A failed attempt is reported as a failure, and any older known result is
  // still shown beside it rather than being replaced by the outage.
  const failed = status.lastAttemptFailed ? (
    <span className="text-sm text-amber-700 dark:text-amber-500">
      Last check could not reach the service
    </span>
  ) : null;

  if (!status.latestResult) {
    return failed ?? <span className={muted}>Bulgarian vignette: not checked yet</span>;
  }

  const { outcome, validUntil, exempt, checkedAt } = status.latestResult;

  return (
    <span className="flex flex-col">
      <span className={muted}>
        {outcome === "ACTIVE"
          ? `Bulgarian vignette: valid${validUntil ? ` until ${asDate(validUntil)}` : ""}${
              exempt ? " (exempt)" : ""
            }`
          : "Bulgarian vignette: none active"}
      </span>
      <span className="text-sm text-neutral-700 dark:text-neutral-300">
        Checked {asDate(checkedAt)}
      </span>
      {failed}
    </span>
  );
}

export default async function CarsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const [cars, vignetteStatuses] = await Promise.all([
    listActiveCars(userId),
    getCarVignetteStatuses(userId),
  ]);
  const statusByCar = new Map(vignetteStatuses.map((status) => [status.carId, status]));

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

              <VignetteLine status={statusByCar.get(car.id)} />

              {/*
                The cooldown decides whether the button exists at all. Offering it
                and then refusing would be worse UX and would invite a replay; the
                action enforces the same rule regardless, because a form post is
                not something a page can prevent.
              */}
              {cooldownFor(statusByCar.get(car.id)) > 0 ? (
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Can check again in about {minutesFrom(cooldownFor(statusByCar.get(car.id)))} min
                </span>
              ) : (
                <form action={checkVignetteAction}>
                  <input type="hidden" name="carId" value={car.id} />
                  <button
                    type="submit"
                    aria-label={`Check the Bulgarian vignette for ${car.licensePlate}`}
                    className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm font-medium dark:border-neutral-700"
                  >
                    Check vignette
                  </button>
                </form>
              )}

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
