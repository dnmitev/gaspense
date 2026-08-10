import Link from "next/link";
import { redirect } from "next/navigation";
import { createExpenseAction } from "@/app/cars/[id]/expenses/actions";
import { ExpenseForm } from "@/app/cars/[id]/expenses/expense-form";
import { listActiveCars } from "@/lib/cars";
import { listVisibleCategories } from "@/lib/categories";
import { carOptionLabel, resolveQuickAddTarget } from "@/lib/quick-add";
import { FUEL_CATEGORY_NAME } from "@/lib/seed-categories";
import { getCurrentUserId } from "@/lib/session";

/**
 * Add an expense without having said which car first.
 *
 * This is the route a home-screen shortcut or a deep link can point at — a
 * per-card button on the dashboard cannot be either. With one car it shows no
 * picker at all; with several it asks, defaulting to the most recently added.
 *
 * **It deliberately accepts no `carId` parameter.** Per-car adds already live at
 * `/cars/[id]/expenses/new`. Accepting an id here would mean deciding what to do
 * with a stale or someone else's — 404, silent fallback, or an error — and every
 * answer is worse than not offering the parameter.
 *
 * A server component, like every page except 04-01's worker registration.
 */
export default async function QuickAddExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { type } = await searchParams;
  const isFuel = type === "fuel";

  const cars = await listActiveCars(userId);
  const target = resolveQuickAddTarget(cars);

  // Nothing to attach an expense to. Sending them to the expense form with an
  // empty car select would be a dead end dressed up as a form.
  if (target.kind === "no-cars") redirect("/cars/new");

  const categories = await listVisibleCategories(userId);

  // Matches a SYSTEM row only (`userId: null`), which no user can rename — the
  // same reasoning as the per-car route. On an unseeded database there is simply
  // no preselection and the form still works.
  const fuelCategory = isFuel
    ? categories.find(
        (category) => category.userId === null && category.name === FUEL_CATEGORY_NAME,
      )
    : undefined;

  const selectedCarId = target.kind === "single" ? target.carId : target.defaultCarId;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isFuel ? "Add fuel" : "Add an expense"}
        </h1>
      </div>

      <ExpenseForm
        action={createExpenseAction}
        submitLabel={isFuel ? "Add fuel" : "Add expense"}
        carId={selectedCarId}
        // Only pass the list when there is a choice to make. One car needs no
        // select, and rendering a one-option combobox is a question with one
        // answer.
        cars={
          target.kind === "choose"
            ? cars.map((car) => ({ id: car.id, label: carOptionLabel(car) }))
            : undefined
        }
        categories={categories}
        showFuelFields={isFuel}
        defaultCategoryId={fuelCategory?.id}
        cancelHref="/"
        focusAmount
      />
    </main>
  );
}
