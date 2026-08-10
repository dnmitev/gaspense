/**
 * The arithmetic behind downscaling a photo, with no canvas and no DOM.
 *
 * Split out so it is unit-testable without a browser — the drawing itself lives
 * in `app/cars/[id]/expenses/attachment-field.tsx`, which needs one.
 *
 * ## Why downscale at all
 *
 * A Vercel serverless request body is capped at **4.5 MB** and a phone photo is
 * routinely 3–6 MB, so an untouched upload fails on exactly the files this
 * feature exists for. A 1600px longest edge at ~85% JPEG puts a typical photo
 * comfortably under 500 KB while staying perfectly readable as a receipt.
 */

/** Longest edge, in pixels, of a stored attachment. */
export const MAX_IMAGE_EDGE = 1600;

export type Dimensions = { width: number; height: number };

/**
 * Target dimensions for an image, preserving aspect ratio.
 *
 * **Never upscales.** An image already within the limit is returned untouched,
 * because re-encoding a small photo larger costs bytes and adds nothing.
 */
export function scaleToFit(source: Dimensions, maxEdge: number = MAX_IMAGE_EDGE): Dimensions {
  const { width, height } = source;

  if (width <= 0 || height <= 0) {
    throw new Error(`Refusing to scale a zero or negative dimension: ${width}x${height}`);
  }

  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const ratio = maxEdge / longest;

  // Round, then floor at 1: a very thin image scaled hard would otherwise round
  // its short edge to 0 and produce a canvas that cannot be drawn.
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
