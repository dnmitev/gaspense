import { describe, expect, it } from "vitest";
import { formatAmountInput, formatEur, parseAmountToCents } from "@/lib/money";

describe("formatEur", () => {
  it("puts the decimal point two digits from the right", () => {
    expect(formatEur(4520)).toBe("€45.20");
  });

  it("pads cents below ten so 45.2 never renders as 45.02", () => {
    expect(formatEur(4502)).toBe("€45.02");
  });

  it("keeps a leading zero for sub-euro amounts", () => {
    expect(formatEur(7)).toBe("€0.07");
    expect(formatEur(0)).toBe("€0.00");
  });

  it("handles large amounts without grouping separators", () => {
    // No thousands separator on purpose: it would have to come back out again
    // through the parser, and "1,234.56" is ambiguous across locales.
    expect(formatEur(123456789)).toBe("€1234567.89");
  });

  it("places the sign before the symbol", () => {
    // Not reachable through the form (the parser rejects negatives), but a
    // stored correction or a future refund must not render as "€-0.-5".
    expect(formatEur(-5)).toBe("-€0.05");
    expect(formatEur(-4520)).toBe("-€45.20");
  });

  it("does not depend on the machine's locale", () => {
    // A locale-sensitive implementation would insert a non-breaking space or a
    // comma here. Assert on the exact code points rather than trusting the eye.
    const formatted = formatEur(1000);
    expect(formatted).toBe("€10.00");
    expect(formatted).not.toContain(" ");
    expect(formatted).not.toContain(",");
  });
});

describe("formatAmountInput", () => {
  it("omits the currency symbol so the value can go into an input", () => {
    expect(formatAmountInput(4520)).toBe("45.20");
    expect(formatAmountInput(7)).toBe("0.07");
  });
});

describe("parseAmountToCents", () => {
  it("accepts whole euros", () => {
    expect(parseAmountToCents("45")).toBe(4500);
  });

  it("accepts one or two decimal places", () => {
    expect(parseAmountToCents("45.2")).toBe(4520);
    expect(parseAmountToCents("45.20")).toBe(4520);
    expect(parseAmountToCents("45.02")).toBe(4502);
  });

  it("accepts a comma as the decimal separator", () => {
    // What a European keyboard produces. parseFloat("12,34") returns 12, which
    // would silently drop the cents.
    expect(parseAmountToCents("12,34")).toBe(1234);
    expect(parseAmountToCents("12,3")).toBe(1230);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseAmountToCents("  45.20  ")).toBe(4520);
  });

  it("rejects more than two decimal places rather than rounding them away", () => {
    // The reason this parses the string: parseFloat would accept "12.345" and
    // round it to 1235 cents, turning a precision rule into an accident.
    expect(parseAmountToCents("12.345")).toBeNull();
    expect(parseAmountToCents("12,345")).toBeNull();
  });

  it("rejects text, empty input, and separators without digits", () => {
    for (const bad of ["", "   ", "abc", "12abc", "€12", ".", ",", ".5", "12.", "12..3"]) {
      expect(parseAmountToCents(bad), `expected ${JSON.stringify(bad)} to be rejected`).toBeNull();
    }
  });

  it("rejects negatives — an expense of -5 is a typo, not a refund", () => {
    expect(parseAmountToCents("-5")).toBeNull();
    expect(parseAmountToCents("-45.20")).toBeNull();
  });

  it("rejects exponent notation", () => {
    // parseFloat("1e3") is 1000; here it is not an amount a user would type.
    expect(parseAmountToCents("1e3")).toBeNull();
  });

  it("is exact for values whose float representation lands just below the target", () => {
    // 4.35 * 100 is 434.99999999999994 in IEEE 754. Math.round happens to
    // recover 435, but this implementation never enters that space at all.
    expect(parseAmountToCents("4.35")).toBe(435);
    expect(parseAmountToCents("1.15")).toBe(115);
    expect(parseAmountToCents("19.99")).toBe(1999);
    expect(parseAmountToCents("0.07")).toBe(7);
  });
});

describe("round trip", () => {
  it("parse(format(cents)) === cents across the range", () => {
    // The property AC-1 actually cares about: nothing is lost in either
    // direction, so an edit form seeded from the database saves back unchanged.
    const values = [0, 1, 7, 9, 10, 99, 100, 101, 435, 1999, 4520, 100000, 99999999];

    for (const cents of values) {
      expect(parseAmountToCents(formatAmountInput(cents)), `round trip for ${cents}`).toBe(cents);
    }
  });
});
