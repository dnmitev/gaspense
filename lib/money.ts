/**
 * Euro ↔ cent conversion. The only place in the codebase where money changes
 * unit.
 *
 * Amounts are stored as `amountCents Int` (see PROJECT.md) so arithmetic stays
 * exact and `SUM()` is trivial for Phase 3's reporting. That choice only pays
 * off if the conversion happens in one audited place: a missed ÷100 is a 100×
 * error that produces a plausible-looking number, so nothing crashes and the
 * report is simply wrong.
 *
 * Callers must call these functions rather than multiplying by a constant —
 * exporting a "cents per euro" number would just relocate the bug.
 *
 * EUR only, by explicit project decision, so a single minor unit is safe and
 * there is no currency parameter.
 */

/** Digits after the decimal point in the minor unit. EUR has two. */
const FRACTION_DIGITS = 2;
const MINOR_UNITS_PER_EURO = 100;

/**
 * Splits cents into a sign and zero-padded major/minor parts.
 *
 * Works on the absolute value so that `-5` cents formats as `-0.05` rather than
 * `-0.-5` — `%` keeps the sign of its left operand in JavaScript.
 */
function parts(cents: number): { sign: string; major: string; minor: string } {
  const rounded = Math.trunc(cents);
  const absolute = Math.abs(rounded);

  return {
    sign: rounded < 0 ? "-" : "",
    major: String(Math.floor(absolute / MINOR_UNITS_PER_EURO)),
    minor: String(absolute % MINOR_UNITS_PER_EURO).padStart(FRACTION_DIGITS, "0"),
  };
}

/**
 * Display form: `4520` → `"€45.20"`.
 *
 * Hand-formatted rather than via `Intl.NumberFormat`/`toLocaleString`. Those
 * are locale-sensitive, and calling them without an explicit locale makes the
 * output depend on the machine — tests would pass here and fail in CI. Pinning
 * a locale would work too, but for a fixed two-decimal euro string this is one
 * line and has no hidden behaviour (some locales insert a non-breaking space
 * before the symbol, which then leaks into assertions and the DOM).
 */
export function formatEur(cents: number): string {
  const { sign, major, minor } = parts(cents);
  return `${sign}€${major}.${minor}`;
}

/**
 * Bare editable form: `4520` → `"45.20"`.
 *
 * Separate from {@link formatEur} because a currency symbol cannot go into an
 * amount input and come back out through {@link parseAmountToCents}. Use this
 * for a form's `defaultValue`, never the raw cents.
 */
export function formatAmountInput(cents: number): string {
  const { sign, major, minor } = parts(cents);
  return `${sign}${major}.${minor}`;
}

/**
 * Parses a user-entered amount into cents. Returns `null` when the input is not
 * a well-formed amount — the caller decides what message to show.
 *
 * Accepts `"45"`, `"45.2"`, `"45.20"`, `"45,20"`, and surrounding whitespace.
 * Rejects empty strings, non-numeric text, more than two decimal places,
 * negatives, exponent notation, and separators without digits on both sides.
 *
 * ## Why this parses the string instead of `parseFloat(x) * 100`
 *
 * Not because the float route rounds wrongly — for well-formed two-decimal
 * input it does not (4.35, 1.15, 19.99 and 0.07 all round correctly despite
 * their binary representations landing just below the target).
 *
 * The real reasons:
 *
 * 1. `parseFloat` silently **accepts** `"12.345"`, so the two-decimal rule
 *    becomes an accident of rounding rather than a check. Here it is a check.
 * 2. `parseFloat("12,34")` returns `12` — it stops at the comma. A comma
 *    decimal separator is what a European keyboard produces, so that would
 *    quietly turn €12.34 into €12.00.
 * 3. `parseFloat` also accepts `"1e3"` and trailing garbage like `"12abc"`.
 */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();

  // Both separators are accepted, but only one, and it must have digits on
  // each side. No sign is permitted: an expense of "-5" is a typo, not a
  // refund, and silently negating it would corrupt every total.
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;

  const [, major, minor = ""] = match;

  return Number(major) * MINOR_UNITS_PER_EURO + Number(minor.padEnd(FRACTION_DIGITS, "0") || "0");
}
