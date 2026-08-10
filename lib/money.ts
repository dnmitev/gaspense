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

/** Digits after the point for a per-kilometre rate. See {@link formatEurPerKm}. */
const RATE_FRACTION_DIGITS = 3;

/**
 * A cost per kilometre: `formatEurPerKm(213_000, 1_000_000)` → `"€0.213"`.
 *
 * ## Why the division lives here
 *
 * Dividing money by a distance is money changing unit, and this module is the
 * only place that may happen. Doing it in a report component would be the first
 * crack in a rule that has held since 02-06 — and the rule is what makes a
 * missed conversion findable, since a 100× error produces a plausible number
 * and crashes nothing.
 *
 * ## Why three decimals rather than two
 *
 * Two decimals collapse €0.128 and €0.134 to the same €0.13, and round a €0.213
 * total-cost figure to €0.21. The whole point of showing fuel cost and total
 * ownership cost side by side is that they differ; rounding away the third
 * digit makes small but real differences invisible. This is a rate rather than
 * a payable amount, so it is not bound by the two-digit minor unit.
 *
 * Returns `null` for a non-positive or non-finite distance. The caller renders
 * an explanation — `Infinity` or `NaN` reaching the page as "€NaN" would be a
 * visible defect, and silently substituting €0.00 would be an invisible one.
 *
 * ## Why this rounds in integer space instead of calling `toFixed`
 *
 * `(21350 / 100 / 1000).toFixed(3)` returns `"0.213"`, not `"0.214"` — the
 * double nearest 0.2135 sits just below it, so the half-way case rounds down.
 * The result is not "round half up" or "round half even" but "whatever the
 * binary representation happened to be", which is unpredictable per input.
 *
 * Rounding thousandths as an integer first removes the ambiguity: `cents * 10 /
 * km` is exactly the rate in thousandths of a euro, and `Math.round` on it is a
 * stated rule. Same reasoning that made {@link formatEur} hand-rolled.
 */
export function formatEurPerKm(cents: number, km: number): string | null {
  if (!Number.isFinite(cents) || !Number.isFinite(km) || km <= 0) return null;

  // Thousandths of a euro: cents / 100 / km * 1000 === cents * 10 / km.
  const THOUSANDTHS_PER_EURO = 1_000;
  const thousandths = Math.round((cents * 10) / km);
  const absolute = Math.abs(thousandths);

  const sign = thousandths < 0 ? "-" : "";
  const major = Math.floor(absolute / THOUSANDTHS_PER_EURO);
  const minor = String(absolute % THOUSANDTHS_PER_EURO).padStart(RATE_FRACTION_DIGITS, "0");

  return `${sign}€${major}.${minor}`;
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
