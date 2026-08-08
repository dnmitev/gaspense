import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createReadingAction } from "@/app/cars/[id]/odometer/actions";
import { OdometerForm } from "@/app/cars/[id]/odometer/odometer-form";
import { getCarById } from "@/lib/cars";
import { getCurrentUserId } from "@/lib/session";

export default async function NewReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id } = await params;

  const car = await getCarById(userId, id);
  if (!car) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/cars/${car.id}/odometer`} className="text-sm underline">
          ← Odometer
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a reading</h1>
      </div>

      <OdometerForm action={createReadingAction} submitLabel="Add reading" carId={car.id} />
    </main>
  );
}
