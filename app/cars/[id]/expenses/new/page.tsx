import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createExpenseAction } from "@/app/cars/[id]/expenses/actions";
import { ExpenseForm } from "@/app/cars/[id]/expenses/expense-form";
import { getCarById } from "@/lib/cars";
import { listVisibleCategories } from "@/lib/categories";

import { FUEL_CATEGORY_NAME } from "@/lib/seed-categories";
import { getCurrentUserId } from "@/lib/session";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const [{ id }, { type }] = await Promise.all([params, searchParams]);

  // Resolve the car before rendering anything: no page shell for a car the
  // caller cannot see.
  const car = await getCarById(userId, id);
  if (!car) notFound();

  const categories = await listVisibleCategories(userId);

  const isFuel = type === "fuel";

  // Only ever matches a SYSTEM row, which no user can rename — so this is not
  // the "branch on user data" trap the schema deliberately avoids. On an
  // unseeded database there is simply no preselection, and the form still works.
  const fuelCategory = isFuel
    ? categories.find(
        (category) => category.userId === null && category.name === FUEL_CATEGORY_NAME,
      )
    : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/expenses`} className="text-sm underline">
          ← {car.nickname ?? car.licensePlate}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isFuel ? "Add fuel" : "Add an expense"}
        </h1>
      </div>

      <ExpenseForm
        action={createExpenseAction}
        submitLabel={isFuel ? "Add fuel" : "Add expense"}
        carId={car.id}
        categories={categories}
        showFuelFields={isFuel}
        defaultCategoryId={fuelCategory?.id}
      />
    </main>
  );
}
