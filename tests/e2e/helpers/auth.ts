import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import type { BrowserContext } from "@playwright/test";
import { PrismaClient } from "../../../lib/generated/prisma/client";

/**
 * Signs a Playwright context in without touching Google.
 *
 * Google OAuth cannot run in CI. Database sessions make this possible: create a
 * Session row and hand its token to the browser as a cookie, which is exactly
 * what NextAuth reads on each request.
 *
 * The cookie name differs by scheme — `authjs.session-token` over http,
 * `__Secure-authjs.session-token` over https. Playwright serves `next start` on
 * http://localhost, so the plain name applies. `signInAs` asserts the app
 * actually accepted the session rather than trusting that.
 */

const SESSION_COOKIE = "authjs.session-token";

function client(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

export type SeededUser = {
  userId: string;
  email: string;
  sessionToken: string;
};

/** Creates a user and an active session, returning what the cookie needs. */
export async function seedUserWithSession(): Promise<SeededUser> {
  const prisma = client();
  try {
    const email = `e2e-${randomUUID()}@example.test`;
    const user = await prisma.user.create({ data: { email } });

    const sessionToken = randomUUID();
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return { userId: user.id, email, sessionToken };
  } finally {
    await prisma.$disconnect();
  }
}

/** Adds the session cookie to a browser context. */
export async function applySessionCookie(
  context: BrowserContext,
  sessionToken: string,
  baseURL: string,
): Promise<void> {
  const { hostname } = new URL(baseURL);

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: sessionToken,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
  ]);
}

/** Removes the seeded user; the session cascades. */
export async function deleteSeededUser(userId: string): Promise<void> {
  const prisma = client();
  try {
    await prisma.user.delete({ where: { id: userId } });
  } finally {
    await prisma.$disconnect();
  }
}
