"use client";

/**
 * template-ancestor: components/ui/chart.tsx   (variation: five Gap sizes as one token at five opacities, the counts printed in the table beside it)
 *
 * The histogram one Setting's kind table adds up to (#289 follow-up).
 *
 * A Gap is 0..4 and ordinal, so the honest picture is **how many of each size**, not a line and
 * not a point: each kind is one stacked bar, and the five segments are the five sizes. The colour
 * runs from a faint step at 0 (In Synch — nothing to see) to a solid one at 4, so the bar's mass
 * reads as "where the differences are" without inventing a judgement about them. Every segment
 * carries its number in the tooltip and the table beside the chart prints all five counts, which
 * is why the drawing is a second channel rather than the only one (WCAG 1.4.1).
 *
 * The numbers arrive already computed: this component does no arithmetic and knows no rule about
 * what counts. `series` is the chart's only input and `GapHistogramSeries` is a type-only import,
 * so nothing here can reach Postgres (`data:check` E34 walks this graph).
 *
 * A chart on this screen is never a summary of two rows — the route withholds it below the
 * population floor (`lib/admin/gap-aggregates.ts::MIN_COMPLETE_INSTANCES`) — and recharts paints
 * nothing until the browser measures the container, so the table beside it is what a reader
 * without JavaScript still gets.
 */
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

/** One bar: a kind and its five counts. `sizes` is index 0..4 — the Gap. */
export interface GapHistogramSeries {
  readonly kind: string;
  readonly label: string;
  readonly sizes: readonly [number, number, number, number, number];
}

/**
 * The five sizes, in order: the stack's data key is the Gap itself, and the fill is one token at
 * five opacities so the ramp says "bigger difference, more ink" without a second palette.
 */
const SIZES = [
  { gap: "0", fill: "hsl(var(--chart-1) / 0.22)" },
  { gap: "1", fill: "hsl(var(--chart-1) / 0.42)" },
  { gap: "2", fill: "hsl(var(--chart-1) / 0.62)" },
  { gap: "3", fill: "hsl(var(--chart-1) / 0.82)" },
  { gap: "4", fill: "hsl(var(--chart-1))" },
] as const;

/** A row of the chart: one kind, flattened to five keys the stacks can name. */
type ChartRow = { kind: string; label: string } & Record<string, string | number>;

function rowsOf(series: readonly GapHistogramSeries[]): ChartRow[] {
  return series.map((row) => {
    const chartRow: ChartRow = { kind: row.kind, label: row.label };
    row.sizes.forEach((count, index) => {
      const segment = SIZES[index];
      if (segment !== undefined) chartRow[segment.gap] = count;
    });
    return chartRow;
  });
}

export function GapHistogram({
  series,
  height = 220,
}: {
  series: readonly GapHistogramSeries[];
  height?: number;
}) {
  const config = Object.fromEntries(
    SIZES.map((segment) => [segment.gap, { label: segment.gap, color: segment.fill }]),
  );

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={rowsOf(series)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={44} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {SIZES.map((segment) => (
          <Bar
            key={segment.gap}
            dataKey={segment.gap}
            stackId="sizes"
            fill={`var(--color-${segment.gap})`}
            radius={segment.gap === "4" ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
