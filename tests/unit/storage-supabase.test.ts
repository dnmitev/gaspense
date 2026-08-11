import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStorage } from "@/lib/storage";
import { createSupabaseStorage } from "@/lib/storage-supabase";

/**
 * The Supabase Storage adapter, driven against a stubbed `fetch`.
 *
 * ⚠️ **A stub answers whatever it is told to, so it can only prove the adapter's
 * shape.** The first version of this file asserted a plain 404 for a missing
 * object, taken from the documented REST surface, and passed. Running against a
 * real project at 04-04's checkpoint showed Supabase returns **HTTP 400** with
 * `{"statusCode":"404","error":"not_found","code":"NoSuchKey"}` — so the adapter
 * threw where it had to return null.
 *
 * The responses below are now the **observed** ones. When this adapter changes,
 * re-verify against a real project rather than trusting these.
 */

/** The real not-found response, copied from a live Supabase project. */
const NOT_FOUND_BODY = JSON.stringify({
  statusCode: "404",
  error: "not_found",
  message: "Object not found",
  code: "NoSuchKey",
});

const notFoundResponse = () =>
  new Response(NOT_FOUND_BODY, { status: 400, statusText: "Bad Request" });

const config = {
  url: "https://example.supabase.co",
  serviceKey: "service-key",
  bucket: "attachments",
};

function stub(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

const bytes = () => new Uint8Array([1, 2, 3]);

describe("createSupabaseStorage — put", () => {
  it("POSTs the bytes to the object path with the service key", async () => {
    const fetchImpl = stub(new Response(null, { status: 200 }));
    const storage = createSupabaseStorage({ ...config, fetchImpl });

    await storage.put("abc.png", bytes(), "image/png");

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = mock.mock.calls[0];

    expect(url).toBe("https://example.supabase.co/storage/v1/object/attachments/abc.png");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer service-key");
    expect(init.headers["content-type"]).toBe("image/png");
  });

  it("tolerates a trailing slash on the project URL", async () => {
    const fetchImpl = stub(new Response(null, { status: 200 }));
    const storage = createSupabaseStorage({
      ...config,
      url: "https://example.supabase.co/",
      fetchImpl,
    });

    await storage.put("abc.png", bytes(), "image/png");

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0]).not.toContain("//storage");
  });

  it("throws when the upload is refused", async () => {
    // Silence here would mean a row pointing at bytes that were never stored.
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(new Response(null, { status: 403, statusText: "Forbidden" })),
    });

    await expect(storage.put("abc.png", bytes(), "image/png")).rejects.toThrow(/refused an upload/);
  });

  it("includes the response body in the error, so a failure is diagnosable", async () => {
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(new Response('{"message":"Bucket not found"}', { status: 404 })),
    });

    await expect(storage.put("abc.png", bytes(), "image/png")).rejects.toThrow(/Bucket not found/);
  });
});

describe("createSupabaseStorage — get", () => {
  it("returns the bytes and the content type", async () => {
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(
        new Response(new Uint8Array([9, 8]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
      ),
    });

    const object = await storage.get("abc.jpg");

    expect(Array.from(object!.body)).toEqual([9, 8]);
    expect(object!.contentType).toBe("image/jpeg");
  });

  it("returns null when Supabase reports not-found as a 400", async () => {
    // ⚠️ The observed behaviour, and the bug the stub originally hid: HTTP 400
    // with the real answer in the body. /api/attachments/[id] turns null into a
    // 410 and anything else into a 500, so throwing here crashed the route for
    // a row whose object had gone.
    const storage = createSupabaseStorage({ ...config, fetchImpl: stub(notFoundResponse()) });

    expect(await storage.get("missing.png")).toBeNull();
  });

  it("also handles a plain 404, in case that ever changes", async () => {
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(new Response(null, { status: 404 })),
    });

    expect(await storage.get("missing.png")).toBeNull();
  });

  it("does NOT treat an ordinary 400 as a missing object", async () => {
    // A malformed request is a real error. Swallowing it as null would report a
    // broken call as a deleted photo.
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(new Response("something else went wrong", { status: 400 })),
    });

    await expect(storage.get("abc.png")).rejects.toThrow(/refused a download/);
  });

  it("throws on any other error rather than reporting a missing object", async () => {
    // The distinction matters: an outage reported as "no such object" looks
    // exactly like a photo the user deleted.
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(new Response(null, { status: 500, statusText: "Server Error" })),
    });

    await expect(storage.get("abc.png")).rejects.toThrow(/refused a download/);
  });
});

describe("createSupabaseStorage — delete", () => {
  it("DELETEs the object path", async () => {
    const fetchImpl = stub(new Response(null, { status: 200 }));
    const storage = createSupabaseStorage({ ...config, fetchImpl });

    await storage.delete("abc.png");

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("treats not-found as success, so deleting twice is safe", async () => {
    // Observed: DELETE of a missing object also returns 400 with the not_found
    // body, not 404.
    const storage = createSupabaseStorage({ ...config, fetchImpl: stub(notFoundResponse()) });

    await expect(storage.delete("gone.png")).resolves.toBeUndefined();
  });

  it("throws on a real failure", async () => {
    const storage = createSupabaseStorage({
      ...config,
      fetchImpl: stub(new Response(null, { status: 500, statusText: "Server Error" })),
    });

    await expect(storage.delete("abc.png")).rejects.toThrow(/refused a delete/);
  });
});

describe("getStorage — driver selection", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env["STORAGE_DRIVER"];
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    delete process.env["SUPABASE_STORAGE_BUCKET"];
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("defaults to the local adapter", () => {
    expect(() => getStorage()).not.toThrow();
  });

  it("refuses supabase with configuration missing, rather than falling back", () => {
    // ⚠️ The whole point. A silent fall back to local storage in production
    // would appear to work and lose every photo on the next request, because
    // Vercel's filesystem is ephemeral.
    process.env["STORAGE_DRIVER"] = "supabase";

    expect(() => getStorage()).toThrow(/SUPABASE_URL/);
    expect(() => getStorage()).toThrow(/Refusing to fall back/);
  });

  it("names every missing variable, not just the first", () => {
    process.env["STORAGE_DRIVER"] = "supabase";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";

    expect(() => getStorage()).toThrow(/SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET/);
  });

  it("builds the supabase adapter when fully configured", () => {
    process.env["STORAGE_DRIVER"] = "supabase";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-key";
    process.env["SUPABASE_STORAGE_BUCKET"] = "attachments";

    expect(() => getStorage()).not.toThrow();
  });
});
