import type { CreateAttachmentResult, UnverifiedAttachment } from "@/lib/attachments";

/**
 * Pulls a posted photo out of a form and hands it to whichever create function
 * owns it.
 *
 * Extracted from `app/cars/[id]/expenses/actions.ts` in 04-04 rather than copied
 * into `app/cars/actions.ts`: a second upload path is a second place to forget
 * the byte-length check, or the MIME sniff, or the size limit. The differences
 * between the two callers are the owner and the create function, so those are
 * the parameters — everything else is identical and stays identical.
 *
 * Returns an error message, or null when there was no photo or it stored fine.
 */
export async function attachPostedPhoto(
  formData: FormData,
  create: (input: UnverifiedAttachment, bytes: Uint8Array) => Promise<CreateAttachmentResult>,
): Promise<string | null> {
  const file = formData.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Dimensions are a hint from the browser, used only to size the <img> so it
  // reserves its space rather than collapsing while it loads. They are not
  // trusted for anything: the byte length and the MIME type are re-derived from
  // the bytes themselves inside the create function.
  const dimension = (name: string): number | undefined => {
    const raw = Number(formData.get(name));
    return Number.isInteger(raw) && raw > 0 ? raw : undefined;
  };

  const result = await create(
    {
      mimeType: file.type,
      sizeBytes: bytes.byteLength,
      width: dimension("attachmentWidth"),
      height: dimension("attachmentHeight"),
    },
    bytes,
  );

  if (result.ok) return null;

  return result.reason === "invalid"
    ? "That photo could not be attached — use a JPEG, PNG or WebP under 2 MB."
    : "That could not be found.";
}
