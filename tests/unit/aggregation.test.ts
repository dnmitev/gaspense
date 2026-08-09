import { afterEach, describe, expect, it } from "vitest";
import { byCategory, byMonth, byYear, totalCents, type ExpenseRow } from "@/lib/aggregation";

// These functions are the reason `lib/aggregation.ts` is separate from
// `lib/reports.ts`: every one of them is provable with no database running.
//
// Two things are worth more scrutiny than the rest — the integer sums, because
// a money bug produces a plausible number rather than a crash, and the UTC
// bucketing, because it is invisible on a UTC machine and CI runs in UTC.

function row(date: string, amountCents: number, category = "cat-fuel", name = "Fuel"): ExpenseRow {
  return { date: new Date(date), amountCents, categoryId: category, categoryName: name };
}

describe("totalCents", () => {
  it("sums the AC-1 amounts exactly", () => {
    // €45.20 + €12.05 + €0.07 = €57.32. Done in cents, so there is no float
    // step in which 0.1 + 0.2 could become 0.30000000000000004.
    const rows = [row("2026-08-01", 4520), row("2026-08-02", 1205), row("2026-08-03", 7)];

    expect(totalCents(rows)).toBe(5732);
  });

  it("returns 0 for no rows rather than NaN or undefined", () => {
    expect(totalCents([])).toBe(0);
  });

  it("stays an integer across many rows", () => {
    const rows = Array.from({ length: 1000 }, () => row("2026-08-01", 1));

    expect(totalCents(rows)).toBe(1000);
    expect(Number.isInteger(totalCents(rows))).toBe(true);
  });
});

describe("byYear", () => {
  it("groups by calendar year, newest first", () => {
    const rows = [row("2024-06-01", 100), row("2026-03-01", 300), row("2025-01-01", 200)];

    expect(byYear(rows)).toEqual([
      { key: "2026", label: "2026", totalCents: 300 },
      { key: "2025", label: "2025", totalCents: 200 },
      { key: "2024", label: "2024", totalCents: 100 },
    ]);
  });

  it("splits a New Year's Eve / New Year's Day pair across two years", () => {
    const rows = [row("2025-12-31", 500), row("2026-01-01", 700)];

    expect(byYear(rows)).toEqual([
      { key: "2026", label: "2026", totalCents: 700 },
      { key: "2025", label: "2025", totalCents: 500 },
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(byYear([])).toEqual([]);
  });
});

describe("byMonth", () => {
  it("groups by calendar month with a sortable key and a readable label", () => {
    const rows = [row("2026-03-04", 1000), row("2026-03-20", 500), row("2026-06-11", 250)];

    expect(byMonth(rows)).toEqual([
      { key: "2026-06", label: "Jun 2026", totalCents: 250 },
      { key: "2026-03", label: "Mar 2026", totalCents: 1500 },
    ]);
  });

  it("omits months with no expenses instead of inventing zero rows", () => {
    // AC-3: March and June, nothing between. April and May must be absent —
    // "€0.00" would claim those months were tracked and cost nothing.
    const result = byMonth([row("2026-03-04", 1000), row("2026-06-11", 250)]);

    expect(result).toHaveLength(2);
    expect(result.map((period) => period.key)).toEqual(["2026-06", "2026-03"]);
  });

  it("orders October after September, which an unpadded key would not", () => {
    // "2026-9" > "2026-10" as a string. The zero padding is what stops the
    // autumn of every year sorting wrongly.
    const rows = [row("2026-09-01", 100), row("2026-10-01", 200)];

    expect(byMonth(rows).map((period) => period.key)).toEqual(["2026-10", "2026-09"]);
  });

  it("splits December and January across both the month and the year", () => {
    const rows = [row("2025-12-31", 500), row("2026-01-01", 700)];

    expect(byMonth(rows)).toEqual([
      { key: "2026-01", label: "Jan 2026", totalCents: 700 },
      { key: "2025-12", label: "Dec 2025", totalCents: 500 },
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(byMonth([])).toEqual([]);
  });

  it("does not depend on the machine's locale", () => {
    // An unpinned locale would render this month differently per machine, so
    // the assertion above would pass here and fail in CI.
    const [period] = byMonth([row("2026-01-15", 100)]);

    expect(period.label).toBe("Jan 2026");
  });
});

describe("bucketing is anchored to UTC, not to the machine's timezone", () => {
  // AC-2. This is the only rule here that is invisible on a UTC machine — and
  // CI runs in UTC, so asserting it against the default timezone would prove
  // nothing at all. Node re-reads process.env.TZ for subsequent Date
  // operations, so each case runs in a timezone where local time and UTC
  // genuinely disagree about which month it is.
  const originalTz = process.env.TZ;

  afterEach(() => {
    // Restored rather than left set: every later test file in this project
    // would otherwise inherit whatever the last case here chose.
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("keeps UTC midnight on the 1st in that month, west of UTC", () => {
    // In New York this instant is 31 Dec 2025, 19:00. getMonth() would say
    // December and the January total would silently lose the expense.
    process.env.TZ = "America/New_York";
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(date.getMonth()).toBe(11); // local disagrees — the test has teeth

    expect(byMonth([row("2026-01-01T00:00:00.000Z", 4520)])[0]).toEqual({
      key: "2026-01",
      label: "Jan 2026",
      totalCents: 4520,
    });
    expect(byYear([row("2026-01-01T00:00:00.000Z", 4520)])[0].key).toBe("2026");
  });

  it("keeps a late-December instant in December, east of UTC", () => {
    // In Tokyo this instant is already 1 Jan 2026, 08:00.
    process.env.TZ = "Asia/Tokyo";
    const date = new Date("2025-12-31T23:00:00.000Z");
    expect(date.getMonth()).toBe(0); // local disagrees the other way

    expect(byMonth([row("2025-12-31T23:00:00.000Z", 900)])[0]).toEqual({
      key: "2025-12",
      label: "Dec 2025",
      totalCents: 900,
    });
    expect(byYear([row("2025-12-31T23:00:00.000Z", 900)])[0].key).toBe("2025");
  });

  it("agrees with how the expense list formats the same date", () => {
    // The list uses Intl with timeZone: "UTC" (app/cars/[id]/expenses/page.tsx).
    // A month total that disagreed with the rows it was computed from is the
    // exact failure this whole block exists to prevent.
    process.env.TZ = "America/New_York";
    const date = new Date("2026-01-01T00:00:00.000Z");

    const listed = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

    expect(listed).toContain("Jan");
    expect(listed).toContain("2026");
    expect(
      byMonth([{ date, amountCents: 1, categoryId: "c", categoryName: "Fuel" }])[0].label,
    ).toBe("Jan 2026");
  });
});

describe("byCategory", () => {
  it("ranks categories by spend and carries each name", () => {
    const rows = [
      row("2026-08-01", 30000, "cat-fuel", "Fuel"),
      row("2026-08-02", 8000, "cat-maint", "Maintenance"),
      row("2026-08-03", 10000, "cat-fuel", "Fuel"),
    ];

    expect(byCategory(rows)).toEqual([
      { categoryId: "cat-fuel", name: "Fuel", totalCents: 40000 },
      { categoryId: "cat-maint", name: "Maintenance", totalCents: 8000 },
    ]);
  });

  it("omits categories with no expenses on this car", () => {
    // AC-4: nothing here invents a row for a category that exists but was
    // never used. The input is the car's expenses, so an unused category
    // simply never appears.
    const result = byCategory([row("2026-08-01", 100, "cat-fuel", "Fuel")]);

    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe("cat-fuel");
  });

  it("breaks ties on name so the order never depends on query order", () => {
    const rows = [
      row("2026-08-01", 5000, "cat-z", "Tires"),
      row("2026-08-02", 5000, "cat-a", "Parking"),
    ];

    expect(byCategory(rows).map((category) => category.name)).toEqual(["Parking", "Tires"]);
  });

  it("keeps two same-named categories apart when their ids differ", () => {
    // A user may create their own "Fuel" alongside the system one. Grouping by
    // name would merge a private category's spend into the shared row.
    const rows = [
      row("2026-08-01", 100, "cat-system-fuel", "Fuel"),
      row("2026-08-02", 200, "cat-user-fuel", "Fuel"),
    ];

    expect(byCategory(rows)).toEqual([
      { categoryId: "cat-user-fuel", name: "Fuel", totalCents: 200 },
      { categoryId: "cat-system-fuel", name: "Fuel", totalCents: 100 },
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(byCategory([])).toEqual([]);
  });
});
