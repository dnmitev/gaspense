import type { PeriodTotal } from "@/lib/aggregation";
import { scaleBars } from "@/lib/chart";
import { formatEur } from "@/lib/money";

/**
 * Monthly spend, as inline SVG rendered on the server.
 *
 * ## Why this is hand-rolled and not a charting library
 *
 * Twelve rectangles do not justify a client-component boundary or the ~150KB a
 * React charting library brings with it. Every page in this app is a server
 * component, and Phase 4 turns it into a PWA where bundle size is a stated
 * concern. This ships no JavaScript at all: the bars exist in the HTML.
 *
 * ## Accessibility is structural here, not decoration
 *
 * A bare `<svg>` full of `<rect>` elements is completely invisible to a screen
 * reader — it announces nothing, so the chart would simply not exist for some
 * users. `role="img"` plus an `aria-label` gives it a name, and a `<title>` per
 * bar puts each month and amount into the accessible tree. Colour carries no
 * meaning here (one series, one fill), so nothing depends on distinguishing
 * hues.
 */

const BAR_HEIGHT = 64;
const BAR_WIDTH = 14;
const BAR_GAP = 6;

/** Oldest-first, which is how a time axis reads. `byMonth` returns newest-first. */
function chronological(months: readonly PeriodTotal[]): PeriodTotal[] {
  return [...months].reverse();
}

export function MonthlyChart({ months }: { months: readonly PeriodTotal[] }) {
  if (months.length === 0) return null;

  const ordered = chronological(months);
  const bars = scaleBars(
    ordered.map((month) => month.totalCents),
    BAR_HEIGHT,
  );

  const width = ordered.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const busiest = ordered.reduce((most, month) =>
    month.totalCents > most.totalCents ? month : most,
  );

  return (
    <section aria-label="Monthly spend" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Monthly spend</h2>

      <svg
        role="img"
        aria-label={`Spending across ${ordered.length} months, from ${ordered[0].label} to ${
          ordered[ordered.length - 1].label
        }. Highest was ${busiest.label} at ${formatEur(busiest.totalCents)}.`}
        viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
        // Fixed height, fluid width: the viewBox scales the bars to whatever
        // the column allows, which is what keeps this working on a phone.
        className="h-16 w-full"
        preserveAspectRatio="none"
      >
        {ordered.map((month, index) => (
          <rect
            key={month.key}
            x={index * (BAR_WIDTH + BAR_GAP)}
            // SVG y grows downward, so a bar is drawn from its top edge.
            y={BAR_HEIGHT - bars[index]}
            width={BAR_WIDTH}
            height={bars[index]}
            rx={2}
            className="fill-neutral-800 dark:fill-neutral-200"
          >
            <title>{`${month.label}: ${formatEur(month.totalCents)}`}</title>
          </rect>
        ))}
      </svg>

      <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
        <span>{ordered[0].label}</span>
        <span>{ordered[ordered.length - 1].label}</span>
      </div>
    </section>
  );
}
