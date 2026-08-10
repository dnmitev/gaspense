import Link from "next/link";
import { redirect } from "next/navigation";
import { MonthlyChart } from "@/app/monthly-chart";
import { getFleetSummary } from "@/lib/fleet";
import { formatEur } from "@/lib/money";
import { getCurrentUserId } from "@/lib/session";

/**
 * The dashboard: what every car costs, without being asked.
 *
 * Replaces the Phase 2 placeholder. `/` now requires a session, matching every
 * other page in the app — there is no public landing page, because nothing
 * about a personal tool needs one and it would mean maintaining a second auth
 * shape.
 *
 * Server component throughout, like the rest of the app. The chart is inline
 * SVG and ships no JavaScript.
 */

/** One decimal is the honest precision for a consumption figure. */
const consumption = (litersPer100Km: number) => `${litersPer100Km.toFixed(1)} L/100km`;

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const fleet = await getFleetSummary(userId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Gaspense</h1>
        <Link href="/cars" className="text-sm underline">
          Your cars
        </Link>
      </div>

      {fleet.cars.length === 0 ? (
        // No chart and no total here. A €0.00 headline would state as fact
        // something the user has simply not told us yet.
        <section aria-label="Get started" className="flex flex-col gap-3">
          <p className="text-neutral-600 dark:text-neutral-400">
            Nothing tracked yet. Add a car and start recording what it costs — fuel, maintenance,
            insurance, everything.
          </p>
          <Link
            href="/cars/new"
            className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Add your first car
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="Total spent" className="flex flex-col">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Total across {fleet.cars.length} {fleet.cars.length === 1 ? "car" : "cars"}
            </span>
            <span className="text-3xl font-semibold tabular-nums">
              {formatEur(fleet.totalCents)}
            </span>
          </section>

          <MonthlyChart months={fleet.byMonth} />

          <section aria-label="Your cars" className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Cars</h2>

            <ul className="flex flex-col gap-3">
              {fleet.cars.map((car) => (
                <li
                  key={car.id}
                  className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  {/*
                    The card is no longer one big link. The add actions below are
                    links too, and a link inside a link is invalid HTML that no
                    browser handles predictably — axe reports it as a nested
                    interactive control. So the report link wraps only the
                    summary it describes.
                  */}
                  <Link
                    href={`/cars/${car.id}/report`}
                    aria-label={`Report for ${car.licensePlate}`}
                    className="flex flex-col gap-1"
                  >
                    <span className="font-mono text-sm font-semibold">{car.licensePlate}</span>
                    {car.nickname ? (
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">
                        {car.nickname}
                      </span>
                    ) : null}
                    <span className="tabular-nums">
                      {formatEur(car.totalCents)}
                      {/*
                        Omitted entirely when unmeasurable. "0.0 L/100km" would
                        assert something false about a car with one fill-up.
                      */}
                      {car.averageLitersPer100Km === null
                        ? ""
                        : ` · ${consumption(car.averageLitersPer100Km)}`}
                    </span>
                  </Link>

                  {/*
                    The point of the whole plan: one tap from here to a form that
                    already knows the car. Names include the plate because a
                    screen reader hears these out of the card's visual context,
                    where four identical "Add fuel" links are useless.
                  */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/cars/${car.id}/expenses/new?type=fuel`}
                      aria-label={`Add fuel for ${car.licensePlate}`}
                      className="flex min-h-11 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                    >
                      Add fuel
                    </Link>
                    <Link
                      href={`/cars/${car.id}/expenses/new`}
                      aria-label={`Add an expense for ${car.licensePlate}`}
                      className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm font-medium dark:border-neutral-700"
                    >
                      Add expense
                    </Link>
                    <Link
                      href={`/cars/${car.id}/expenses`}
                      aria-label={`All expenses for ${car.licensePlate}`}
                      className="flex min-h-11 items-center px-1 text-sm underline"
                    >
                      History
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
