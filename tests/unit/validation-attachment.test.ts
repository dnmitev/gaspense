import { describe, expect, it } from "vitest";
import {
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentInputSchema,
  bytesMatchMimeType,
} from "@/lib/validation/attachment";

/**
 * What may be stored, and whether the bytes really are what they claim.
 *
 * Two independent checks, and both are tested here because either alone is
 * trivially defeated: the allowlist by renaming a file, the byte sniff by
 * nothing at all if the declared type is simply trusted.
 */

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const webp = () =>
  new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
  ]);

describe("attachmentInputSchema", () => {
  it.each(ACCEPTED_MIME_TYPES)("accepts %s", (mimeType) => {
    const result = attachmentInputSchema.safeParse({ mimeType, sizeBytes: 1024 });
    expect(result.success).toBe(true);
  });

  it("rejects a type that is not an image", () => {
    const result = attachmentInputSchema.safeParse({
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it("rejects SVG, which is an image and also a script host", () => {
    const result = attachmentInputSchema.safeParse({
      mimeType: "image/svg+xml",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const result = attachmentInputSchema.safeParse({
      mimeType: "image/jpeg",
      sizeBytes: MAX_ATTACHMENT_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a file exactly at the limit", () => {
    const result = attachmentInputSchema.safeParse({
      mimeType: "image/jpeg",
      sizeBytes: MAX_ATTACHMENT_BYTES,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty file", () => {
    const result = attachmentInputSchema.safeParse({ mimeType: "image/jpeg", sizeBytes: 0 });
    expect(result.success).toBe(false);
  });
});

describe("bytesMatchMimeType", () => {
  it("recognises each accepted format from its leading bytes", () => {
    expect(bytesMatchMimeType(jpeg(), "image/jpeg")).toBe(true);
    expect(bytesMatchMimeType(png(), "image/png")).toBe(true);
    expect(bytesMatchMimeType(webp(), "image/webp")).toBe(true);
  });

  it("refuses a PNG that claims to be a JPEG", () => {
    // The whole point: a MIME string from a browser is a claim, not a fact.
    expect(bytesMatchMimeType(png(), "image/jpeg")).toBe(false);
    expect(bytesMatchMimeType(jpeg(), "image/png")).toBe(false);
  });

  it("refuses arbitrary bytes claiming to be an image", () => {
    const executable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(bytesMatchMimeType(executable, "image/png")).toBe(false);
    expect(bytesMatchMimeType(executable, "image/jpeg")).toBe(false);
  });

  it("refuses a RIFF container that is not WebP", () => {
    // "RIFF" alone also starts a WAV file, which is why WebP needs both of its
    // signatures rather than just the first.
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(bytesMatchMimeType(wav, "image/webp")).toBe(false);
  });

  it("refuses a type it does not know at all", () => {
    expect(bytesMatchMimeType(jpeg(), "image/gif")).toBe(false);
  });

  it("refuses a file too short to identify", () => {
    expect(bytesMatchMimeType(new Uint8Array([0xff]), "image/jpeg")).toBe(false);
  });
});
