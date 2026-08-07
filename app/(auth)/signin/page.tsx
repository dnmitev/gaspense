import { signIn } from "@/auth";

// Deliberately plain. Real UI work belongs to 02-05/02-06; this exists so the
// auth flow is exercisable.
export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Gaspense</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Each person has their own account and sees only their own cars and expenses.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/protected" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Continue with Google
        </button>
      </form>
    </main>
  );
}
