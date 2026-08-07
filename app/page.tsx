// Deliberately minimal placeholder. The real interface — dashboard, car list,
// quick-add expense — arrives in plans 02-05 and 02-06.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Gaspense</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Vehicle expense tracking. The application shell is in place; features arrive in later plans.
      </p>
    </main>
  );
}
