import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getCurrentUserId } from "@/lib/session";

// Exists to make the redirect-when-unauthenticated behaviour real and testable.
// Uses getCurrentUserId rather than requireUserId because "signed out" is a
// legitimate, handled branch here — it redirects rather than throwing.
export default async function ProtectedPage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/signin");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Authentication works. Cars and expenses arrive in the next plans.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
