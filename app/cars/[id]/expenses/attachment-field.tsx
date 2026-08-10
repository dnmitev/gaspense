"use client";

import { useRef, useState } from "react";
import { MAX_IMAGE_EDGE, scaleToFit } from "@/lib/image";
import { ACCEPTED_MIME_TYPES } from "@/lib/validation/attachment";

/**
 * A photo field that shrinks the image before it is ever uploaded.
 *
 * ⚠️ The downscaling is NOT an optimisation. A Vercel serverless request body is
 * capped at **4.5 MB** and a phone photo is routinely 3–6 MB, so a plain upload
 * fails on exactly the files this feature exists for. A 1600px longest edge at
 * ~85% JPEG puts a typical photo comfortably under 500 KB.
 *
 * This is the app's second client component, after 04-01's service-worker
 * registration. It earns the boundary: `<canvas>` cannot run on a server.
 *
 * **The browser is never trusted.** If canvas is unavailable, or the image
 * cannot be decoded, the original file is left in place and the server's size
 * and MIME validation refuses it — a slightly worse error for the user and no
 * hole at all. The arithmetic lives in `lib/image.ts` so it can be unit-tested
 * without a browser; only the drawing is here.
 */

const ACCEPT = ACCEPTED_MIME_TYPES.join(",");

/** Quality for the re-encode. 0.85 is visually indistinguishable on a receipt. */
const JPEG_QUALITY = 0.85;

type Prepared = { file: File | null; width: number; height: number };

async function downscale(file: File): Promise<Prepared | null> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const target = scaleToFit({ width: bitmap.width, height: bitmap.height }, MAX_IMAGE_EDGE);

    // Already small enough: re-encoding would cost quality and could even grow
    // the file. Leave the file alone — but still report the dimensions, which is
    // what lets the <img> reserve its space and avoid a layout shift.
    if (target.width === bitmap.width && target.height === bitmap.height) {
      return { file: null, width: bitmap.width, height: bitmap.height };
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return null;

    // Always JPEG after a re-encode, whatever went in — the name follows the
    // real type so the server's sniff and the declared type agree.
    return {
      file: new File([blob], "photo.jpg", { type: "image/jpeg" }),
      width: target.width,
      height: target.height,
    };
  } finally {
    bitmap.close();
  }
}

export function AttachmentField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  async function handleChange() {
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!input || !file) {
      setNote(null);
      setSize(null);
      return;
    }

    const prepared = await downscale(file);
    if (!prepared) {
      // Canvas unavailable or the image would not decode. The original file is
      // uploaded untouched and the server's size and MIME checks decide.
      setNote(null);
      setSize(null);
      return;
    }

    // Dimensions travel even when the file itself was left alone: they are what
    // let the <img> reserve its space instead of collapsing to nothing while it
    // loads.
    setSize({ width: prepared.width, height: prepared.height });

    if (!prepared.file) {
      setNote(null);
      return;
    }

    // Replace the input's file so this stays an ordinary multipart upload
    // rather than a base64 field — DataTransfer is the only way to set
    // `input.files` programmatically.
    const transfer = new DataTransfer();
    transfer.items.add(prepared.file);
    input.files = transfer.files;

    const kb = Math.round(prepared.file.size / 1024);
    setNote(`Resized for upload — about ${kb} KB.`);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="attachment" className="text-sm font-medium">
        Photo <span className="text-neutral-700 dark:text-neutral-300">(optional)</span>
      </label>
      <input
        ref={inputRef}
        id="attachment"
        name="attachment"
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-950"
      />
      {/* Reported by the browser, believed by nobody: the server re-reads the
          real byte length and sniffs the type regardless. These only spare the
          <img> from collapsing while it loads. */}
      <input type="hidden" name="attachmentWidth" value={size?.width ?? ""} />
      <input type="hidden" name="attachmentHeight" value={size?.height ?? ""} />

      {/* Announced when it appears: the resize happens silently otherwise, and a
          file quietly changing size is worth telling someone about. */}
      <p className="text-sm text-neutral-700 dark:text-neutral-300" role="status">
        {note}
      </p>
    </div>
  );
}
