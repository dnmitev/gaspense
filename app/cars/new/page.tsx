import Link from "next/link";
import { redirect } from "next/navigation";
import { createCarAction } from "@/app/cars/actions";
import { CarForm } from "@/app/cars/car-form";
import { getCurrentUserId } from "@/lib/session";

export default async function NewCarPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/cars" className="text-sm underline">
          ← Your cars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a car</h1>
      </div>

      <CarForm action={createCarAction} submitLabel="Add car" />
    </main>
  );
}
