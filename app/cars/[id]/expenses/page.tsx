import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteExpenseButton } from "@/app/cars/[id]/expenses/delete-expense-button";
import { getCarById } from "@/lib/cars";
import { listExpensesForCar } from "@/lib/expenses";
import { formatEur } from "@/lib/money";
import { getCurrentUserId } from "@/lib/session";

/** Fixed locale: the server's default would make output depend on the machine. */
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id } = await params;

  // Scoped, so another user's car — or a soft-deleted one — yields null and is
  // indistinguishable from a car that never existed. That is what delivers AC-6:
  // a deleted car has no reachable route to its expenses.
  const car = await getCarById(userId, id);
  if (!car) notFound();

  const expenses = await listExpensesForCar(userId, car.id);

  // Sum the integers, format once. Cents never become euros before this line.
  const totalCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/cars" className="text-sm underline">
          ← Your cars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {car.nickname ?? car.licensePlate}
        </h1>
        <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {car.licensePlate}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">Total spent</span>
          <span className="text-2xl font-semibold tabular-nums">{formatEur(totalCents)}</span>
        </div>
        {/*
          Two entry points rather than one form carrying every field. Fuel is
          the expense people log most often and the only one with extra fields,
          so it earns its own button instead of cluttering the common case.
        */}
        <div className="flex items-center gap-2">
          <Link
            href={`/cars/${car.id}/expenses/new?type=fuel`}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Add fuel
          </Link>
          <Link
            href={`/cars/${car.id}/expenses/new`}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700"
          >
            Add other
          </Link>
        </div>
      </div>

      {expenses.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          No expenses yet. Add the first one to start tracking what this car costs.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{expense.category.name}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatEur(expense.amountCents)}
                </span>
              </div>

              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {dateFormat.format(expense.date)}
                {expense.liters ? ` · ${expense.liters} L` : ""}
                {expense.station ? ` · ${expense.station}` : ""}
              </span>

              {expense.notes ? (
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {expense.notes}
                </span>
              ) : null}

              <div className="flex items-center gap-4">
                <Link
                  href={`/cars/${car.id}/expenses/${expense.id}/edit`}
                  className="text-sm underline"
                >
                  Edit
                </Link>
                <DeleteExpenseButton
                  expenseId={expense.id}
                  carId={car.id}
                  label={`${expense.category.name} · ${formatEur(expense.amountCents)}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
