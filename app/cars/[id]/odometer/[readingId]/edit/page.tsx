import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateReadingAction } from "@/app/cars/[id]/odometer/actions";
import { OdometerForm } from "@/app/cars/[id]/odometer/odometer-form";
import { getCarById } from "@/lib/cars";
import { getReadingById } from "@/lib/odometer";
import { getCurrentUserId } from "@/lib/session";

export default async function EditReadingPage({
  params,
}: {
  params: Promise<{ id: string; readingId: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id, readingId } = await params;

  const [car, reading] = await Promise.all([
    getCarById(userId, id),
    getReadingById(userId, readingId),
  ]);

  // Both lookups are scoped. The carId check also stops a valid reading id from
  // being edited through some other car's URL.
  if (!car || !reading || reading.carId !== car.id) notFound();

  const action = updateReadingAction.bind(null, reading.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/odometer`} className="text-sm underline">
          ← Odometer
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit reading</h1>
      </div>

      <OdometerForm
        action={action}
        submitLabel="Save changes"
        carId={car.id}
        reading={{ date: reading.date.toISOString().slice(0, 10), reading: reading.reading }}
      />
    </main>
  );
}
