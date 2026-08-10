/**
 * Bar scaling for the dashboard chart.
 *
 * ## Why three lines of arithmetic are a module
 *
 * The naive form — `value / max * height` — inlined into JSX has a failure mode
 * that does not look like one. When every value is zero, `max` is zero, the
 * division yields `NaN`, and React renders `height="NaN"` into the SVG. The
 * browser ignores the attribute, the chart draws nothing, and nothing anywhere
 * throws. A user with a brand new account sees an empty rectangle and no
 * explanation.
 *
 * Pulling it out makes that case, and the other degenerate ones, provable
 * without a browser. Like `lib/aggregation.ts` and `lib/consumption.ts`, this
 * file imports nothing at all.
 */

/**
 * Pixel heights for a bar chart, largest value mapping to `height`.
 *
 * Guarantees, each of which has a test:
 * - an empty series returns `[]`, never `[NaN]`
 * - an all-zero series returns zeros, never `NaN`
 * - negative or non-finite values are clamped to zero rather than emitting a
 *   negative `height` attribute, which browsers drop silently
 * - a non-positive or non-finite `height` yields zeros rather than propagating
 * - results are whole pixels, so the rendered markup is stable between renders
 *   and end-to-end assertions do not chase sub-pixel drift
 */
export function scaleBars(values: readonly number[], height: number): number[] {
  const usableHeight = Number.isFinite(height) && height > 0 ? height : 0;

  // Clamped first so a stray negative cannot become the maximum and invert the
  // whole chart.
  const clamped = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));

  // Reduced rather than `Math.max(...clamped)`: spreading a large array into
  // arguments can exceed the call-stack limit. Twelve months would be fine
  // today, but this is the kind of limit that is discovered in production.
  const max = clamped.reduce((highest, value) => (value > highest ? value : highest), 0);

  if (max === 0 || usableHeight === 0) return clamped.map(() => 0);

  return clamped.map((value) => Math.round((value / max) * usableHeight));
}
