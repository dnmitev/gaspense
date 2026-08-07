import type { Adapter, AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createTestClient, resetDatabase } from "./helpers";

// AC-1: @auth/prisma-adapter declares `@prisma/client >=2.26.0 || ...` — which is
// open-ended and admits 7.x — but a declaration is not proof. This exercises the
// adapter's own methods against Prisma 7's generated client and driver adapter,
// because everything in this plan and the next two is built on top of them.

const prisma: PrismaClient = createTestClient();
// The adapter is typed against Prisma's own client type; ours is generated to a
// custom path, so the shape is structurally compatible but not nominally equal.
const adapter: Adapter = PrismaAdapter(prisma as never);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("@auth/prisma-adapter against Prisma 7", () => {
  it("creates and reads a user", async () => {
    const created = (await adapter.createUser!({
      id: "ignored-by-adapter",
      email: "adapter@example.test",
      emailVerified: null,
      name: "Adapter Person",
    })) as AdapterUser;

    expect(created.id).toBeTruthy();
    expect(created.email).toBe("adapter@example.test");

    const byId = await adapter.getUser!(created.id);
    expect(byId?.email).toBe("adapter@example.test");

    const byEmail = await adapter.getUserByEmail!("adapter@example.test");
    expect(byEmail?.id).toBe(created.id);
  });

  it("links an OAuth account and finds the user by it", async () => {
    const user = (await adapter.createUser!({
      id: "x",
      email: "linked@example.test",
      emailVerified: null,
    })) as AdapterUser;

    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-subject-123",
      // Phase 6's Drive export depends on this surviving the round-trip.
      refresh_token: "fake-refresh-token-not-real",
      access_token: "fake-access-token-not-real",
      expires_at: 1_900_000_000,
      token_type: "bearer",
      scope: "openid email profile",
    });

    const found = await adapter.getUserByAccount!({
      provider: "google",
      providerAccountId: "google-subject-123",
    });
    expect(found?.id).toBe(user.id);

    // Confirm the refresh token actually persisted — the whole reason database
    // sessions were chosen over JWT.
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.refresh_token).toBe("fake-refresh-token-not-real");
    expect(account.expires_at).toBe(1_900_000_000);
  });

  it("creates a session and reads back both session and user", async () => {
    const user = (await adapter.createUser!({
      id: "y",
      email: "session@example.test",
      emailVerified: null,
    })) as AdapterUser;

    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await adapter.createSession!({
      sessionToken: "test-session-token",
      userId: user.id,
      expires,
    });

    const pair = await adapter.getSessionAndUser!("test-session-token");
    expect(pair).not.toBeNull();
    expect(pair!.user.id).toBe(user.id);
    expect(pair!.session.userId).toBe(user.id);
    // `expires` must round-trip as a Date, not a string — NextAuth compares it.
    expect(pair!.session.expires).toBeInstanceOf(Date);
    expect(pair!.session.expires.getTime()).toBeCloseTo(expires.getTime(), -3);

    await adapter.deleteSession!("test-session-token");
    expect(await adapter.getSessionAndUser!("test-session-token")).toBeNull();
  });

  it("cascades account and session deletion when a user is removed", async () => {
    const user = (await adapter.createUser!({
      id: "z",
      email: "cascade@example.test",
      emailVerified: null,
    })) as AdapterUser;

    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-subject-456",
    });
    await adapter.createSession!({
      sessionToken: "cascade-token",
      userId: user.id,
      expires: new Date(Date.now() + 3_600_000),
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
