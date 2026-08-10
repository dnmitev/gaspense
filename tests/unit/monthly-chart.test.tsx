import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthlyChart } from "@/app/monthly-chart";
import type { PeriodTotal } from "@/lib/aggregation";

// Replaces tests/unit/page.test.tsx, which rendered the Phase 2 placeholder
// home page. `/` is now a server component that reads the session, so it pulls
// next-auth into jsdom and cannot be rendered here at all.
//
// The original file's stated purpose was proving the harness is wired — React
// 19 + TypeScript + the JSX transform + jsdom + the "@/" alias. That purpose is
// kept by pointing at a component that IS renderable, and this one earns real
// assertions besides: the SVG's bar geometry is worth checking in a DOM rather
// than only through a browser.

const month = (key: string, label: string, totalCents: number): PeriodTotal => ({
  key,
  label,
  totalCents,
});

describe("MonthlyChart", () => {
  it("renders bars for each month, tallest for the largest total", () => {
    const { container } = render(
      <MonthlyChart
        months={[month("2026-03", "Mar 2026", 4_000), month("2026-02", "Feb 2026", 2_000)]}
      />,
    );

    const bars = container.querySelectorAll("rect");
    expect(bars).toHaveLength(2);

    // byMonth hands over newest-first; a time axis reads oldest-first, so the
    // chart reverses. February is therefore drawn first.
    expect(bars[0].getAttribute("height")).toBe("32");
    expect(bars[1].getAttribute("height")).toBe("64");
  });

  it("never emits a NaN height for an all-zero series", () => {
    // The failure that renders nothing and throws nothing.
    const { container } = render(
      <MonthlyChart months={[month("2026-03", "Mar 2026", 0), month("2026-02", "Feb 2026", 0)]} />,
    );

    for (const bar of container.querySelectorAll("rect")) {
      expect(bar.getAttribute("height")).toBe("0");
      expect(bar.getAttribute("height")).not.toBe("NaN");
    }
  });

  it("names itself for a screen reader rather than being an unlabelled graphic", () => {
    render(
      <MonthlyChart
        months={[month("2026-03", "Mar 2026", 4_000), month("2026-02", "Feb 2026", 2_000)]}
      />,
    );

    const chart = screen.getByRole("img");

    expect(chart).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Spending across 2 months"),
    );
    expect(chart).toHaveAttribute("aria-label", expect.stringContaining("Mar 2026"));
    expect(chart).toHaveAttribute("aria-label", expect.stringContaining("€40.00"));
  });

  it("gives every bar its own accessible title with month and amount", () => {
    const { container } = render(<MonthlyChart months={[month("2026-03", "Mar 2026", 4_000)]} />);

    expect(container.querySelector("title")?.textContent).toBe("Mar 2026: €40.00");
  });

  it("renders nothing at all when there are no months", () => {
    const { container } = render(<MonthlyChart months={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
