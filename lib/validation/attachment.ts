import { z } from "zod";

/**
 * What may be stored as an attachment.
 *
 * Two independent checks, because a browser's MIME string is a claim rather
 * than a fact: the declared type must be on the allowlist, **and** the file's
 * leading bytes must agree with it. Either alone is trivially defeated — the
 * allowlist by renaming, the sniff by nothing at all if the claim is trusted.
 */

/** Only raster formats a browser can both produce and display. No SVG: it executes script. */
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * 2 MB, well under Vercel's 4.5 MB body cap.
 *
 * The browser downscales before upload, so a real photo arrives far below this.
 * The limit is the backstop for a browser that did not — an old one, a scripted
 * client, or the no-canvas fallback path.
 */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const attachmentInputSchema = z.object({
  mimeType: z.enum(ACCEPTED_MIME_TYPES, {
    message: "Attach a JPEG, PNG or WebP image.",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive("That file is empty.")
    .max(MAX_ATTACHMENT_BYTES, "That image is too large — 2 MB is the limit."),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

/** Leading bytes that identify each accepted format. */
const SIGNATURES: { mimeType: string; bytes: number[]; offset: number }[] = [
  { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  // WebP is a RIFF container: "RIFF" then four size bytes then "WEBP".
  { mimeType: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  { mimeType: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

function matches(bytes: Uint8Array, signature: { bytes: number[]; offset: number }): boolean {
  if (bytes.length < signature.offset + signature.bytes.length) return false;
  return signature.bytes.every((byte, index) => bytes[signature.offset + index] === byte);
}

/**
 * True when the bytes really are the type they claim to be.
 *
 * WebP needs both of its signatures — "RIFF" alone also matches a WAV file.
 */
export function bytesMatchMimeType(bytes: Uint8Array, mimeType: string): boolean {
  const relevant = SIGNATURES.filter((signature) => signature.mimeType === mimeType);
  if (relevant.length === 0) return false;

  return relevant.every((signature) => matches(bytes, signature));
}
