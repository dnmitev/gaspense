import { getAttachmentForUser } from "@/lib/attachments";
import { getCurrentUserId } from "@/lib/session";
import { getStorage } from "@/lib/storage";

/**
 * Serves an attachment to its owner and to nobody else.
 *
 * ## Why a proxy route rather than a signed URL
 *
 * A signed URL works for whoever holds it until it expires, and isolation would
 * then have to be argued about URL minting rather than demonstrated by a request
 * being refused. Here the refusal is the mechanism, and it is testable with the
 * same shape as every other scoped path in the project.
 *
 * ## 404, never 403
 *
 * A 403 tells the caller the id exists and belongs to someone else, which is
 * precisely the fact worth hiding. The same reasoning as `createExpense`
 * returning one null for both "no such car" and "not your car".
 *
 * ## Caching
 *
 * `/api/*` is already outside the service worker's cache allowlist (04-01), so
 * no photo ever lands in Cache Storage. `private, no-store` says the same thing
 * to the browser and any proxy in between — a user's receipt is not a shared
 * resource.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  // No session: 404 too. A redirect to /signin would confirm the id resolves.
  if (!userId) return new Response(null, { status: 404 });

  const { id } = await context.params;

  const attachment = await getAttachmentForUser(userId, id);
  if (!attachment) return new Response(null, { status: 404 });

  const object = await getStorage().get(attachment.storageKey);
  // The row exists but the object does not — a real possibility once a second
  // storage backend is in play. Reported honestly rather than as a 404, because
  // this one IS the owner's and the distinction matters when debugging.
  if (!object) return new Response(null, { status: 410 });

  return new Response(new Uint8Array(object.body), {
    status: 200,
    headers: {
      // The type validated on the way in, echoed back — never re-derived from
      // the key's extension.
      "content-type": object.contentType,
      "content-length": String(object.body.byteLength),
      "cache-control": "private, no-store",
      // The bytes were sniffed on upload, but a browser that sniffs again could
      // still be talked into treating them as something else.
      "x-content-type-options": "nosniff",
    },
  });
}
