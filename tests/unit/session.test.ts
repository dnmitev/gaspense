import { beforeEach, describe, expect, it, vi } from "vitest";

// AC-4. The single most valuable negative test in this plan.
//
// Isolation is application-layer with no RLS backstop, and Prisma treats
// `undefined` in a `where` clause as "no condition" rather than "match nothing".
// So a helper that returned undefined for a signed-out caller would turn
// `where: { userId }` into an unfiltered query over every user's rows.
//
// These tests exist to make that regression impossible to introduce quietly.

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));

const { getCurrentUserId, requireUserId, requireUser, UnauthenticatedError } =
  await import("@/lib/session");

beforeEach(() => {
  auth.mockReset();
});

describe("getCurrentUserId", () => {
  it("returns the id from a valid session", async () => {
    auth.mockResolvedValue({ user: { id: "user-123", email: "a@example.test" } });

    await expect(getCurrentUserId()).resolves.toBe("user-123");
  });

  it("returns null when there is no session at all", async () => {
    auth.mockResolvedValue(null);

    await expect(getCurrentUserId()).resolves.toBeNull();
  });

  it("returns null when a session exists but carries no user id", async () => {
    auth.mockResolvedValue({ user: { email: "a@example.test" } });

    await expect(getCurrentUserId()).resolves.toBeNull();
  });
});

describe("requireUserId", () => {
  it("returns the id when authenticated", async () => {
    auth.mockResolvedValue({ user: { id: "user-123" } });

    await expect(requireUserId()).resolves.toBe("user-123");
  });

  // The three cases below are the ones that matter. In every one, returning a
  // falsy value instead of throwing would silently widen any query built on it.
  it("throws when there is no session", async () => {
    auth.mockResolvedValue(null);

    await expect(requireUserId()).rejects.toThrow(UnauthenticatedError);
  });

  it("throws when the session has no user", async () => {
    auth.mockResolvedValue({});

    await expect(requireUserId()).rejects.toThrow(UnauthenticatedError);
  });

  it("throws when the user has no id", async () => {
    auth.mockResolvedValue({ user: { email: "a@example.test" } });

    await expect(requireUserId()).rejects.toThrow(UnauthenticatedError);
  });

  it("never resolves to a falsy value — the property that prevents query widening", async () => {
    for (const session of [null, undefined, {}, { user: {} }, { user: { id: "" } }]) {
      auth.mockResolvedValue(session);
      await expect(requireUserId()).rejects.toThrow();
    }
  });
});

describe("requireUser", () => {
  it("returns the user fields when authenticated", async () => {
    auth.mockResolvedValue({
      user: { id: "user-123", email: "a@example.test", name: "A", image: null },
    });

    await expect(requireUser()).resolves.toEqual({
      id: "user-123",
      email: "a@example.test",
      name: "A",
      image: null,
    });
  });

  it("throws when unauthenticated", async () => {
    auth.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow(UnauthenticatedError);
  });
});
