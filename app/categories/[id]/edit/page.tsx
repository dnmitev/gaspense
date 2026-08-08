import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { renameCategoryAction } from "@/app/categories/actions";
import { CategoryForm } from "@/app/categories/category-form";
import { listOwnCategories } from "@/lib/categories";
import { getCurrentUserId } from "@/lib/session";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const { id } = await params;

  // Looked up among the caller's OWN categories, so a system row or another
  // user's is a 404 here — the same answer, which is the point.
  const category = (await listOwnCategories(userId)).find((entry) => entry.id === id);
  if (!category) notFound();

  const action = renameCategoryAction.bind(null, category.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/categories" className="text-sm underline">
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Rename category</h1>
      </div>

      <CategoryForm action={action} submitLabel="Save changes" name={category.name} showCancel />
    </main>
  );
}
