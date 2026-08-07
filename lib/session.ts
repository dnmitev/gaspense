import { auth } from "@/auth";

/**
 * The single way any code learns who is asking.
 *
 * ## Why this file matters more than it looks
 *
 * This project uses NextAuth rather than Supabase Auth, which means per-user
 * isolation is enforced **in application code with no Postgres RLS backstop**.
 * If a query forgets its `userId` filter, the database will happily return every
 * user's rows. There is nothing underneath to catch it.
 *
 * The dangerous failure mode is subtle: Prisma treats `undefined` in a `where`
 * clause as *"no condition"*, not *"match nothing"*. So this:
 *
 * ```ts
 * const userId = await getCurrentUserId();          // null when signed out
 * prisma.car.findMany({ where: { userId: userId! } })
 * ```
 *
 * would silently return **all cars belonging to everyone** for a signed-out
 * caller. `requireUserId()` exists so that path is impossible: it either returns
 * a real id or throws. Never make it return a falsy value.
 */

export class UnauthenticatedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Returns the signed-in user's id, or `null` when there is no session.
 *
 * Only use this where "signed out" is a legitimate, handled branch — for
 * example deciding whether to render a sign-in link. **Never** feed the result
 * straight into a Prisma `where`; use {@link requireUserId} for that.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Returns the signed-in user's id, or throws {@link UnauthenticatedError}.
 *
 * This is the function every data-access path should call. It cannot return
 * `null` or `undefined`, so it cannot accidentally widen a query.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new UnauthenticatedError();
  }

  return userId;
}

/**
 * Returns the full session user, or throws. Prefer {@link requireUserId} unless
 * the name, email, or avatar is genuinely needed — a narrower return value is
 * harder to misuse.
 */
export async function requireUser(): Promise<{
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    throw new UnauthenticatedError();
  }

  return { id: user.id, email: user.email, name: user.name, image: user.image };
}
