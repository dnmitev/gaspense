import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteCarAttachmentAction, updateCarAction } from "@/app/cars/actions";
import { CarForm } from "@/app/cars/car-form";
import { listAttachmentsForCar } from "@/lib/attachments";
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
  const attachments = await listAttachmentsForCar(userId, car.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/cars" className="text-sm underline">
          ← Your cars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit car</h1>
      </div>

      {attachments.length > 0 ? (
        <section aria-label="Photos" className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Photos</h2>

          <ul className="flex flex-col gap-3">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex flex-col gap-2">
                {/*
                  Same markup as the expense edit page, and for the same reasons:
                  a plain <img> because the bytes come from an ownership-checked
                  route the optimiser must not cache, explicit width/height so
                  the space is reserved, and an alt that describes what the image
                  IS rather than guessing what it shows.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element -- ownership-checked route; see above */}
                <img
                  src={`/api/attachments/${attachment.id}`}
                  alt={`Photo of ${car.licensePlate}`}
                  width={attachment.width ?? undefined}
                  height={attachment.height ?? undefined}
                  className="h-auto w-full max-w-xs rounded-lg border border-neutral-200 dark:border-neutral-800"
                />

                <form action={deleteCarAttachmentAction}>
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

      <CarForm action={action} submitLabel="Save changes" car={car} />
    </main>
  );
}
