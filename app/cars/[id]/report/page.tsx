import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CategoryTotal, PeriodTotal } from "@/lib/aggregation";
import { getCarById } from "@/lib/cars";
import { formatEur } from "@/lib/money";
import { getCarReport } from "@/lib/reports";
import { getCurrentUserId } from "@/lib/session";

/**
 * What one car has cost, all time and broken down.
 *
 * Every figure on this page is a euro string produced by `formatEur` at the
 * point of display. Nothing above this file divides by 100 — see
 * `lib/aggregation.ts`, which deals only in cents.
 *
 * No charts and no period filter here by design: 03-03 owns the dashboard and
 * decides then whether a charting library earns its place.
 */

/** A label-and-amount row. Shared by all three breakdowns, which are the same shape. */
function TotalRow({ label, totalCents }: { label: string; totalCents: number }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-neutral-200 py-2 last:border-b-0 dark:border-neutral-800">
      <span>{label}</span>
      <span className="font-medium tabular-nums">{formatEur(totalCents)}</span>
    </li>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: (PeriodTotal | CategoryTotal)[];
  empty: string;
}) {
  return (
    // Labelled so each breakdown is its own landmark. Three lists of
    // label-and-amount rows are indistinguishable to a screen reader otherwise —
    // and the same labelling is what lets a test assert "€57.32 in the year
    // section" rather than "€57.32 somewhere on the page", which is ambiguous
    // whenever a period happens to hold the whole total.
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{title}</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <TotalRow
              key={"key" in row ? row.key : row.categoryId}
              label={"key" in row ? row.label : row.name}
              totalCents={row.totalCents}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id } = await params;

  // Two scoped reads. The car supplies the heading; the report refuses the same
  // cases the car does, so a stranger's car and a soft-deleted one are both
  // indistinguishable from one that never existed.
  const [car, report] = await Promise.all([getCarById(userId, id), getCarReport(userId, id)]);
  if (!car || !report) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/expenses`} className="text-sm underline">
          ← Expenses
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {car.nickname ?? car.licensePlate}
        </h1>
        <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {car.licensePlate}
        </p>
      </div>

      <section aria-label="Total spent" className="flex flex-col">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">Total spent</span>
        <span className="text-3xl font-semibold tabular-nums">{formatEur(report.totalCents)}</span>
      </section>

      <Section
        title="By year"
        rows={report.byYear}
        empty="No expenses recorded yet, so there is nothing to total."
      />
      <Section
        title="By month"
        rows={report.byMonth}
        empty="Months appear here once expenses are recorded."
      />
      <Section
        title="By category"
        rows={report.byCategory}
        empty="Categories appear here once expenses are recorded."
      />
    </main>
  );
}
