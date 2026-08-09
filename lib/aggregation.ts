/**
 * Bucketing and summing for reports. Pure functions over plain rows — no
 * database, no session, no framework.
 *
 * ## Why this is a separate module from `lib/reports.ts`
 *
 * `npm test` must keep passing with Docker stopped, so the fast feedback loop
 * never waits on a container. Everything here is therefore reachable by a unit
 * test: this file imports no Prisma client, no generated types, and nothing
 * from `lib/prisma.ts`. `lib/reports.ts` owns the scoped query and composes
 * these functions over what it fetches.
 *
 * Aggregating in JavaScript rather than in SQL is a deliberate trade. Personal
 * data is a few hundred rows per car, and a SQL `date_trunc` would move the
 * UTC-bucketing rule below into a raw query no unit test could reach — which is
 * exactly the rule most likely to be got wrong.
 *
 * ## Everything here returns cents
 *
 * Money is stored as `amountCents Int` and `lib/money.ts` is the only place it
 * changes unit. Nothing in this file divides by 100: a missed conversion is a
 * 100× error that produces a plausible number and crashes nothing, so the
 * conversion stays where it can be audited. Callers format at the point of
 * display.
 */

/**
 * The shape the report needs from an expense.
 *
 * Declared here rather than imported from the generated Prisma client, which
 * would drag the client into the unit test and defeat the point of the split.
 * It also keeps the calculation coupled to four fields rather than to the whole
 * schema — `lib/reports.ts` flattens a query result into this.
 */
export type ExpenseRow = {
  date: Date;
  amountCents: number;
  categoryId: string;
  categoryName: string;
};

/** A period total: a sortable key, a human label, and the sum in cents. */
export type PeriodTotal = {
  key: string;
  label: string;
  totalCents: number;
};

/** A category total. Carries the id so a caller can link back to the category. */
export type CategoryTotal = {
  categoryId: string;
  name: string;
  totalCents: number;
};

/**
 * Fixed locale and fixed timezone, for the same reason `lib/money.ts` formats
 * by hand: an unpinned locale makes the output depend on the machine, so a test
 * passes here and fails in CI. UTC matches how `app/cars/[id]/expenses/page.tsx`
 * renders the very dates being bucketed.
 */
const monthLabelFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Bucket keys are built from the **UTC** parts of the date, never the local
 * ones.
 *
 * Dates reach the database as UTC midnight — `<input type="date">` yields
 * "2026-01-01", which `z.coerce.date()` parses as `2026-01-01T00:00:00.000Z` —
 * and the expense list formats them back with `timeZone: "UTC"`. Using
 * `getMonth()` here instead would put that expense in December for any user
 * west of UTC, so the monthly total would silently disagree with the list it
 * was computed from. Nothing would crash; the number would simply be wrong.
 *
 * The month is zero-padded so keys sort correctly as strings: "2026-10" must
 * come after "2026-09", which "2026-9" would not.
 */
function yearKey(date: Date): string {
  return String(date.getUTCFullYear());
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Groups rows into period buckets, newest first.
 *
 * Shared by {@link byYear} and {@link byMonth} because the only difference
 * between them is how a row becomes a key and a label. Sorting on the key
 * descending works because both key formats are zero-padded and
 * lexicographically ordered.
 */
function byPeriod(
  rows: readonly ExpenseRow[],
  toKey: (date: Date) => string,
  toLabel: (date: Date) => string,
): PeriodTotal[] {
  const buckets = new Map<string, PeriodTotal>();

  for (const row of rows) {
    const key = toKey(row.date);
    const existing = buckets.get(key);

    if (existing) {
      existing.totalCents += row.amountCents;
    } else {
      buckets.set(key, { key, label: toLabel(row.date), totalCents: row.amountCents });
    }
  }

  // Periods with no expenses are absent rather than zero-filled. A report is a
  // record of what happened, and a row reading "€0.00" claims a month was
  // tracked and cost nothing, which is a different statement from "nothing was
  // logged". A chart that wants a continuous axis can fill the gaps itself.
  return [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Sum of every row, in cents. Integers only — see the module note. */
export function totalCents(rows: readonly ExpenseRow[]): number {
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}

/** Yearly totals, newest year first. Key `"2026"`, label `"2026"`. */
export function byYear(rows: readonly ExpenseRow[]): PeriodTotal[] {
  return byPeriod(rows, yearKey, yearKey);
}

/** Monthly totals, newest month first. Key `"2026-01"`, label `"Jan 2026"`. */
export function byMonth(rows: readonly ExpenseRow[]): PeriodTotal[] {
  return byPeriod(rows, monthKey, (date) => monthLabelFormat.format(date));
}

/**
 * Category totals, biggest spend first.
 *
 * Ties break on name ascending. Without that second key the order of two
 * equal-valued categories would depend on `Array.prototype.sort` stability over
 * whatever order the query returned — deterministic in practice, but not
 * something a test should have to depend on.
 *
 * Grouped by id rather than name: two categories can share a name (one system,
 * one the user's own), and merging them would attribute spend to the wrong row.
 */
export function byCategory(rows: readonly ExpenseRow[]): CategoryTotal[] {
  const buckets = new Map<string, CategoryTotal>();

  for (const row of rows) {
    const existing = buckets.get(row.categoryId);

    if (existing) {
      existing.totalCents += row.amountCents;
    } else {
      buckets.set(row.categoryId, {
        categoryId: row.categoryId,
        name: row.categoryName,
        totalCents: row.amountCents,
      });
    }
  }

  return [...buckets.values()].sort(
    (a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name),
  );
}
