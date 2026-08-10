import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalStorage, newStorageKey } from "@/lib/storage";

/**
 * The local filesystem storage adapter.
 *
 * Runs against a temporary directory, so it stays a unit test: no database, no
 * container, and nothing written near the developer's own `.storage/`.
 */

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "gaspense-storage-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const bytes = (...values: number[]) => new Uint8Array(values);

describe("createLocalStorage", () => {
  it("round-trips an object with its content type", () => {
    const storage = createLocalStorage(root);

    return (async () => {
      await storage.put("a.png", bytes(1, 2, 3), "image/png");

      const object = await storage.get("a.png");
      expect(object).not.toBeNull();
      expect(Array.from(object!.body)).toEqual([1, 2, 3]);
      // Echoed back from what was stored, never re-derived from the extension.
      expect(object!.contentType).toBe("image/png");
    })();
  });

  it("returns null for a key that was never written", async () => {
    const storage = createLocalStorage(root);
    // A missing object is an ordinary outcome — a row and its object can
    // disagree — so it is reported, not thrown.
    expect(await storage.get("missing.png")).toBeNull();
  });

  it("returns null after a delete, and deleting twice is safe", async () => {
    const storage = createLocalStorage(root);
    await storage.put("b.jpg", bytes(9), "image/jpeg");

    await storage.delete("b.jpg");
    expect(await storage.get("b.jpg")).toBeNull();

    await expect(storage.delete("b.jpg")).resolves.toBeUndefined();
  });

  it("refuses a key that escapes the storage root", async () => {
    const storage = createLocalStorage(root);
    // Generated keys cannot contain a separator, so this is belt and braces —
    // but a path check that only runs while the caller is trusted is a check
    // that stops running the day something else calls it.
    await expect(storage.put("../escape.png", bytes(1), "image/png")).rejects.toThrow(
      /escapes the storage root/,
    );
    await expect(storage.get("../../etc/passwd")).resolves.toBeNull();
  });

  it("keeps two objects independent", async () => {
    const storage = createLocalStorage(root);
    await storage.put("one.png", bytes(1), "image/png");
    await storage.put("two.png", bytes(2), "image/png");

    await storage.delete("one.png");

    expect(await storage.get("one.png")).toBeNull();
    expect(await storage.get("two.png")).not.toBeNull();
  });
});

describe("newStorageKey", () => {
  it("derives the extension from the validated MIME type", () => {
    expect(newStorageKey("image/jpeg")).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(newStorageKey("image/png")).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(newStorageKey("image/webp")).toMatch(/^[0-9a-f-]{36}\.webp$/);
  });

  it("never repeats a key", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newStorageKey("image/png")));
    expect(keys.size).toBe(200);
  });

  it("contains no path separator, so it cannot escape the root", () => {
    expect(newStorageKey("image/png")).not.toContain("/");
  });

  it("refuses a MIME type that is not on the allowlist", () => {
    // The key is where a client-supplied filename would otherwise sneak in.
    expect(() => newStorageKey("application/pdf")).toThrow(/Refusing to build a key/);
  });
});
