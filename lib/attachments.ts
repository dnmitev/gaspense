import { prisma } from "@/lib/prisma";
import { getStorage, newStorageKey } from "@/lib/storage";
import { attachmentInputSchema, bytesMatchMimeType } from "@/lib/validation/attachment";

/**
 * Scoped data access for attachments.
 *
 * `Attachment` carries no `userId`, exactly like `Expense`: ownership resolves
 * through `expense → car → userId`. Every function therefore takes `userId`
 * explicitly and puts it in the same query as the id, so a wrong owner matches
 * zero rows rather than being checked separately and then forgotten.
 *
 * Writes have no WHERE clause to carry scoping, so `createAttachmentForExpense`
 * verifies ownership with an explicit pre-check first — the same shape as
 * `createExpense`.
 */

/** An expense the given user owns, expressed as a relation filter. */
const ownedExpense = (userId: string) => ({
  car: { userId, deletedAt: null },
});

export type CreateAttachmentResult =
  { ok: true; id: string } | { ok: false; reason: "not-found" | "invalid" };

/**
 * What a caller knows before validation: a MIME type the browser claimed and a
 * byte count. Deliberately loose — `mimeType` is a plain `string` because
 * `File.type` is, and narrowing it is this module's job rather than the
 * caller's. Typing it as the enum would push the parse out to every call site.
 */
export type UnverifiedAttachment = {
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

/**
 * Stores the bytes and records the row, in that order.
 *
 * If the row insert fails the object is deleted again — an orphan in storage is
 * invisible and accumulates, whereas a row without an object is at least
 * detectable. Neither is good; this is the one that cannot silently grow.
 */
export async function createAttachmentForExpense(
  userId: string,
  expenseId: string,
  input: UnverifiedAttachment,
  bytes: Uint8Array,
): Promise<CreateAttachmentResult> {
  const parsed = attachmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  // The declared type must match the actual bytes. A browser's MIME string is
  // a claim, and this is the check that makes it a fact.
  if (!bytesMatchMimeType(bytes, parsed.data.mimeType)) return { ok: false, reason: "invalid" };
  if (bytes.byteLength !== parsed.data.sizeBytes) return { ok: false, reason: "invalid" };

  // An insert has no WHERE clause, so ownership is an explicit pre-check.
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, ...ownedExpense(userId) },
    select: { id: true },
  });
  if (!expense) return { ok: false, reason: "not-found" };

  const storage = getStorage();
  const storageKey = newStorageKey(parsed.data.mimeType);

  await storage.put(storageKey, bytes, parsed.data.mimeType);

  try {
    const created = await prisma.attachment.create({
      data: {
        expenseId: expense.id,
        storageKey,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        width: parsed.data.width ?? null,
        height: parsed.data.height ?? null,
      },
      select: { id: true },
    });

    return { ok: true, id: created.id };
  } catch (error) {
    await storage.delete(storageKey);
    throw error;
  }
}

/** The attachments on an expense the user owns. Empty for anyone else's. */
export function listAttachmentsForExpense(userId: string, expenseId: string) {
  return prisma.attachment.findMany({
    where: { expenseId, expense: { id: expenseId, ...ownedExpense(userId) } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * One attachment, or null if it is not this user's.
 *
 * Null rather than throwing, because the serving route turns it into a **404**
 * — never a 403. A 403 confirms the id exists, which is the one thing the
 * response must not reveal.
 */
export function getAttachmentForUser(userId: string, attachmentId: string) {
  return prisma.attachment.findFirst({
    where: { id: attachmentId, expense: ownedExpense(userId) },
  });
}

/** Removes the row and the stored object. Returns the number of rows affected. */
export async function deleteAttachment(userId: string, attachmentId: string): Promise<number> {
  const attachment = await getAttachmentForUser(userId, attachmentId);
  if (!attachment) return 0;

  const result = await prisma.attachment.deleteMany({
    where: { id: attachmentId, expense: ownedExpense(userId) },
  });

  if (result.count > 0) await getStorage().delete(attachment.storageKey);

  return result.count;
}
