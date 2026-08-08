import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateExpenseAction } from "@/app/cars/[id]/expenses/actions";
import { ExpenseForm } from "@/app/cars/[id]/expenses/expense-form";
import { getCarById } from "@/lib/cars";
import { getExpenseById, listVisibleCategories } from "@/lib/expenses";
import { formatAmountInput } from "@/lib/money";
import { getCurrentUserId } from "@/lib/session";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id, expenseId } = await params;

  const [car, expense] = await Promise.all([
    getCarById(userId, id),
    getExpenseById(userId, expenseId),
  ]);

  // Both lookups are scoped. The carId check also stops a valid expense id from
  // being edited through some other car's URL.
  if (!car || !expense || expense.carId !== car.id) notFound();

  const categories = await listVisibleCategories(userId);
  const action = updateExpenseAction.bind(null, expense.id);

  // Show the fuel fields expanded when this expense already carries any, and
  // collapsed otherwise — derived from the row rather than from its category,
  // which a user may rename.
  const hasFuelDetails =
    expense.liters !== null || expense.station !== null || expense.fullTank !== null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/expenses`} className="text-sm underline">
          ← {car.nickname ?? car.licensePlate}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit expense</h1>
      </div>

      <ExpenseForm
        action={action}
        submitLabel="Save changes"
        carId={car.id}
        categories={categories}
        showFuelFields={hasFuelDetails}
        expense={{
          categoryId: expense.categoryId,
          // Formatted for the input, never raw cents — seeding 4520 here would
          // save back as €45.20 -> €4520.00 on the next submit.
          amount: formatAmountInput(expense.amountCents),
          date: expense.date.toISOString().slice(0, 10),
          notes: expense.notes,
          liters: expense.liters,
          station: expense.station,
          fullTank: expense.fullTank,
        }}
      />
    </main>
  );
}
