import Link from "next/link";
import { redirect } from "next/navigation";
import { createCategoryAction } from "@/app/categories/actions";
import { CategoryForm } from "@/app/categories/category-form";
import { DeleteCategoryButton } from "@/app/categories/delete-category-button";
import { listOwnCategories, listSystemCategories } from "@/lib/categories";
import { getCurrentUserId } from "@/lib/session";

export default async function CategoriesPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const [own, system] = await Promise.all([listOwnCategories(userId), listSystemCategories()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/cars" className="text-sm underline">
          ← Your cars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Add a category
        </h2>
        <CategoryForm action={createCategoryAction} submitLabel="Add category" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Your own</h2>

        {own.length === 0 ? (
          <p className="text-neutral-600 dark:text-neutral-400">
            You have not added any categories yet. The built-in ones below are always available.
          </p>
        ) : (
          <ul aria-label="Your categories" className="flex flex-col gap-3">
            {own.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <span className="font-medium">{category.name}</span>
                <div className="flex items-center gap-4">
                  <Link href={`/categories/${category.id}/edit`} className="text-sm underline">
                    Rename
                  </Link>
                  <DeleteCategoryButton categoryId={category.id} name={category.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Built in</h2>
        {/*
          Listed explicitly, and explained. These are shared by every account, so
          they are not editable — without saying so, their absence from the list
          above reads as a missing feature rather than a deliberate one.
        */}
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Available to everyone and shared across all accounts, so they cannot be renamed or
          deleted. Add your own above if you need something different.
        </p>
        <ul aria-label="Built-in categories" className="flex flex-wrap gap-2">
          {system.map((category) => (
            <li
              key={category.id}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400"
            >
              {category.name}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
