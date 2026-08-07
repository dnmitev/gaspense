import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// NextAuth v5 (Auth.js). The Google provider reads AUTH_GOOGLE_ID and
// AUTH_GOOGLE_SECRET from the environment by convention — see .env.example.
//
// Session strategy is "database": a Session row means a live login, which makes
// sessions revocable, and the Account row the adapter writes is where Phase 6's
// Google Drive export will find its refresh token.
//
// No Drive scopes are requested here. Phase 6 owns that — asking for them now
// would enlarge the consent screen for a feature that does not exist.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as never),
  providers: [Google],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      // With the database strategy, `user` is the adapter's user row. Copying
      // the id onto the session is what lib/session.ts reads — without this,
      // every scoped query would have nothing to filter on.
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
