import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateCarAction } from "@/app/cars/actions";
import { CarForm } from "@/app/cars/car-form";
import { getCarById } from "@/lib/cars";
import { getCurrentUserId } from "@/lib/session";

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id } = await params;

  // getCarById is scoped, so another user's id yields null — indistinguishable
  // from a car that does not exist, which is what we want.
  const car = await getCarById(userId, id);
  if (!car) notFound();

  const action = updateCarAction.bind(null, car.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/cars" className="text-sm underline">
          ← Your cars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit car</h1>
      </div>

      <CarForm action={action} submitLabel="Save changes" car={car} />
    </main>
  );
}
