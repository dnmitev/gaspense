import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteAttachmentAction, updateExpenseAction } from "@/app/cars/[id]/expenses/actions";
import { ExpenseForm } from "@/app/cars/[id]/expenses/expense-form";
import { listAttachmentsForExpense } from "@/lib/attachments";
import { getCarById } from "@/lib/cars";
import { listVisibleCategories } from "@/lib/categories";
import { getExpenseById } from "@/lib/expenses";
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

  const [categories, attachments] = await Promise.all([
    listVisibleCategories(userId),
    listAttachmentsForExpense(userId, expense.id),
  ]);
  const action = updateExpenseAction.bind(null, expense.id);

  // Show the fuel fields expanded when this expense already carries any, and
  // collapsed otherwise — derived from the row rather than from its category,
  // which a user may rename.
  const hasFuelDetails =
    expense.liters !== null ||
    expense.station !== null ||
    expense.fullTank !== null ||
    expense.odometerReading !== null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/expenses`} className="text-sm underline">
          ← {car.nickname ?? car.licensePlate}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit expense</h1>
      </div>

      {attachments.length > 0 ? (
        <section aria-label="Photos" className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Photos</h2>

          <ul className="flex flex-col gap-3">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex flex-col gap-2">
                {/*
                  Plain <img>, not next/image: the bytes come from an
                  ownership-checked route, so the optimiser would need to be
                  told about an endpoint it must not cache. width/height come
                  from the stored dimensions and reserve the space, which is
                  what next/image would have been for.

                  The alt describes what it is rather than what it shows —
                  nothing here can know the contents of a user's photo, and a
                  guess would be worse than an honest label.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element -- see above: the optimiser cannot be pointed at an ownership-checked route it must not cache */}
                <img
                  src={`/api/attachments/${attachment.id}`}
                  alt="Photo attached to this expense"
                  width={attachment.width ?? undefined}
                  height={attachment.height ?? undefined}
                  className="h-auto w-full max-w-xs rounded-lg border border-neutral-200 dark:border-neutral-800"
                />

                <form action={deleteAttachmentAction}>
                  <input type="hidden" name="attachmentId" value={attachment.id} />
                  <input type="hidden" name="carId" value={car.id} />
                  <button type="submit" className="flex min-h-11 items-center text-sm underline">
                    Remove photo
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
          odometer: expense.odometerReading?.reading,
        }}
      />
    </main>
  );
}
