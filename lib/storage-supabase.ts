import type { ObjectStorage } from "@/lib/storage";

/**
 * Supabase Storage, over its REST API with `fetch`.
 *
 * ## Why no @supabase/supabase-js
 *
 * Three calls against a documented REST surface do not justify the project's
 * first runtime dependency since Phase 2 — and, being honest about the
 * situation this was written in: the SDK could not have been verified any more
 * easily than this can, because there is no Supabase project to verify against
 * yet. A dependency that buys no extra confidence is just a dependency.
 * Consistent with hand-rolled Tailwind, hand-rolled SVG charts and a
 * hand-written service worker.
 *
 * ## ⚠️ Server-only
 *
 * The service role key bypasses every row-level policy. It must never reach a
 * `NEXT_PUBLIC_*` variable and this module must never be imported by a client
 * component — the bytes reach the browser through `/api/attachments/[id]`,
 * which checks ownership first.
 *
 * ## ⚠️ The bucket must be PRIVATE
 *
 * A public bucket serves every object at a guessable URL with no session check,
 * which bypasses the serving route entirely and undoes the whole ownership
 * design. Nothing in this file can enforce that — it is a setting on the bucket,
 * and it is checked by hand at 04-04's checkpoint.
 */

export type SupabaseStorageConfig = {
  /** Project URL, e.g. https://abcdefgh.supabase.co — no trailing slash needed. */
  url: string;
  /** Service role key. Server-only. */
  serviceKey: string;
  /** Bucket name. Must be private. */
  bucket: string;
  /** Injectable so tests can drive this without a network. */
  fetchImpl?: typeof fetch;
};

/**
 * Whether a failed response means "no such object", and the body either way.
 *
 * ⚠️ **Supabase reports a missing object as HTTP 400, not 404.** The body carries
 * the real answer:
 *
 * ```json
 * {"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}
 * ```
 *
 * This was found by running the adapter against a real project at 04-04's
 * checkpoint. The unit tests, written against a stub built from the documented
 * REST surface, asserted 404 — and passed, because a stub answers whatever it is
 * told to. Status alone is not the signal here.
 *
 * Getting this wrong is not cosmetic: `get` must return null for a missing
 * object, because `/api/attachments/[id]` turns that into a 410 and anything
 * else into a 500. A row whose object has gone would have crashed the route.
 *
 * The body is returned too, so a genuine failure carries a diagnosable message
 * instead of a bare status.
 */
async function classify(response: Response): Promise<{ notFound: boolean; detail: string }> {
  const detail = await response.text().catch(() => "");

  if (response.status === 404) return { notFound: true, detail };

  if (response.status === 400) {
    try {
      const parsed = JSON.parse(detail) as Record<string, unknown>;
      const notFound =
        parsed["statusCode"] === "404" ||
        parsed["error"] === "not_found" ||
        parsed["code"] === "NoSuchKey";
      return { notFound, detail };
    } catch {
      // A 400 that is not JSON is a real error, not a missing object.
    }
  }

  return { notFound: false, detail };
}

/** Keeps an error message useful without pasting an entire response body into a log. */
const truncate = (detail: string) => (detail.length > 200 ? `${detail.slice(0, 200)}…` : detail);

export function createSupabaseStorage(config: SupabaseStorageConfig): ObjectStorage {
  const base = config.url.replace(/\/+$/, "");
  const doFetch = config.fetchImpl ?? fetch;

  const objectUrl = (key: string) =>
    `${base}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeURIComponent(key)}`;

  const authHeaders = () => ({
    authorization: `Bearer ${config.serviceKey}`,
    // Supabase expects both; the apikey header is what its gateway routes on.
    apikey: config.serviceKey,
  });

  return {
    async put(key, body, contentType) {
      const response = await doFetch(objectUrl(key), {
        method: "POST",
        headers: { ...authHeaders(), "content-type": contentType },
        body: body as BodyInit,
      });

      if (!response.ok) {
        const { detail } = await classify(response);
        throw new Error(
          `Supabase storage refused an upload: ${response.status} ${response.statusText} ${truncate(detail)}`,
        );
      }
    },

    async get(key) {
      const response = await doFetch(objectUrl(key), { headers: authHeaders() });

      if (!response.ok) {
        const { notFound, detail } = await classify(response);

        // A missing object is an ordinary outcome — the row and the object can
        // disagree — so it is reported, matching the local adapter's contract.
        if (notFound) return null;

        // Anything else IS an error and must not be mistaken for "no such
        // object", which would make an outage look like a deleted photo.
        throw new Error(
          `Supabase storage refused a download: ${response.status} ${response.statusText} ${truncate(detail)}`,
        );
      }

      const buffer = await response.arrayBuffer();
      return {
        body: new Uint8Array(buffer),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
      };
    },

    async delete(key) {
      const response = await doFetch(objectUrl(key), {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) {
        const { notFound, detail } = await classify(response);

        // Not found is success: deleting twice must be safe, as it is locally.
        if (notFound) return;

        throw new Error(
          `Supabase storage refused a delete: ${response.status} ${response.statusText} ${truncate(detail)}`,
        );
      }
    },
  };
}
