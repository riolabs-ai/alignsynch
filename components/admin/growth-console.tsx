"use client";

/**
 * template-ancestor: components/console/gap-histogram.tsx   (variation: one histogram becomes four bands over one committed model — a run-rate ramp with the target drawn on it, cohort retention curves, a stacked plan mix and two churn rates, each in a Card with the words it reads)
 *
 * `/admin/growth` — the growth model, for an operator (#920).
 *
 * **The template, and the axes it varies.** `GapHistogram` is a `ChartContainer` over an array of
 * rows, its config built from the data rather than typed twice, a `ChartTooltip` and a legend-free
 * axis pair — no table beside it, because its counts are printed by its caller. Here:
 *
 *   gap-histogram                this screen
 *   ---------------------------  ----------------------------------------------------------------
 *   one chart, five stacked bars four bands, one question each (run rate, retention, mix, churn)
 *   sizes are a fixed scale      every series is a projection of the model's own rows
 *   no reference line            the run-rate band draws the **target** on the chart, so "$3M" is
 *                                a line the data crosses rather than a sentence about the data
 *   numbers printed beside it    the invoice band *is* the table: counts to reconcile, not a shape
 *
 * **Why it is a client component.** recharts paints from a browser measurement, so
 * `ChartContainer` is `"use client"` all the way down. The model arrives as one serialisable prop
 * from the server page and nothing here fetches, holds state or reads a clock: the same props
 * produce the same SVG in the server render and after hydration.
 *
 * **Nothing here computes a number the model did not.** Percentages are the artifact's own basis
 * points and dollars are its own cents — a chart that re-derived a rate would be a second opinion
 * about a fact the artifact already states, which is exactly the drift the model exists to prevent
 * (`content/growth-model.ts`, `pnpm growth:check`).
 *
 * **The words are the fixture's** (`data/pages/admin-growth.ts`, E23 budget 0): every caption,
 * axis label, series name and failure sentence is read out of `copy`, so the screen cannot grow a
 * sentence the fixture does not carry.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { GrowthModel } from "@/content/growth-model";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import { AlertTriangle } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

/** Integer cents and basis points, rendered with an explicit locale so server and client agree. */
const usd = (cents: number): string =>
  `$${Math.round(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const count = (value: number): string => value.toLocaleString("en-US");

const pct = (bps: number): string => `${(bps / 100).toFixed(1)}%`;

/** A dollar axis, abbreviated: `$3.0M` is a tick, not a sentence. */
const compactUsd = (dollars: number): string => {
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}k`;
  return `$${Math.round(dollars)}`;
};

/** One caption, its number, and the unit it is counted in. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint === undefined ? null : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A band: the fixture's heading and body, then whatever the band charts. */
function Band({ section, children }: { section: PageCopySection; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.heading}</CardTitle>
        <CardDescription>{section.body}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Chart colour slots, in the order the token layer paints them (`app/globals.css`). */
const SLOTS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/**
 * The cohorts whose retention curves are drawn: at most five, spread across the ramp.
 *
 * Five lines is what stays legible at 390 px; the spread is what makes the point — the earliest
 * cohort has the longest curve, and the latest has none to speak of.
 */
function retentionCohorts(model: GrowthModel): GrowthModel["cohorts"] {
  const last = model.cohorts.length - 1;
  if (last <= 0) return model.cohorts;
  const wanted = Math.min(5, model.cohorts.length);
  const indices = Array.from({ length: wanted }, (_, step) =>
    Math.round((step * last) / Math.max(1, wanted - 1)),
  );
  return model.cohorts.filter((_, index) => indices.includes(index));
}

export function GrowthConsole({ copy, model }: { copy: PageCopy; model: GrowthModel }) {
  const runRate = sectionOf(copy, "run-rate");
  const retentionBand = sectionOf(copy, "retention");
  const planBand = sectionOf(copy, "plan-mix");
  const churnBand = sectionOf(copy, "churn");
  const invoiceBand = sectionOf(copy, "invoices");

  const finalMonth = model.months[model.months.length - 1];
  const targetDollars = Math.round(model.params.targetArrCents / 100);

  const rampData = model.months.map((month) => ({
    label: month.label,
    arr: Math.round(month.arrCents / 100),
    mrr: Math.round(month.mrrCents / 100),
  }));

  const arrConfig: ChartConfig = {
    arr: { label: itemLabel(runRate, "series-arr"), color: SLOTS[0] },
    mrr: { label: itemLabel(runRate, "series-mrr"), color: SLOTS[1] },
  };

  const cohorts = retentionCohorts(model);
  const retentionKeys = cohorts.map((cohort) => `c${cohort.month}`);
  const retentionData = Array.from({ length: model.params.months }, (_, age) => {
    const row: Record<string, number | string> = { age, label: `${age}` };
    for (const cohort of cohorts) {
      const point = cohort.retention.find((entry) => entry.age === age);
      if (point) row[`c${cohort.month}`] = Math.round(point.retentionBps) / 100;
    }
    return row;
  });
  const retentionConfig: ChartConfig = Object.fromEntries(
    cohorts.map((cohort, index) => [
      `c${cohort.month}`,
      { label: cohort.label, color: SLOTS[index % SLOTS.length] },
    ]),
  );

  const planData = model.months.map((month) => {
    const row: Record<string, number | string> = { label: month.label };
    for (const slice of month.plans) row[slice.plan] = slice.accounts;
    return row;
  });
  const planConfig: ChartConfig = Object.fromEntries(
    model.plans.map((plan, index) => [
      plan.id,
      { label: plan.label, color: SLOTS[index % SLOTS.length] },
    ]),
  );

  const churnData = model.months.map((month) => ({
    label: month.label,
    logo: Math.round(month.logoChurnBps) / 100,
    revenue: Math.round(month.revenueChurnBps) / 100,
  }));
  const churnConfig: ChartConfig = {
    logo: { label: itemLabel(churnBand, "series-logo-churn"), color: SLOTS[0] },
    revenue: { label: itemLabel(churnBand, "series-revenue-churn"), color: SLOTS[2] },
  };

  const invoiceRows = (finalMonth?.plans ?? []).map((slice) => {
    const plan = model.plans.find((candidate) => candidate.id === slice.plan);
    return {
      plan: plan?.label ?? slice.plan,
      issued: slice.invoices.issued,
      paid: slice.invoices.paid,
      failed: slice.invoices.failed,
      refunded: slice.invoices.refunded,
      collectedCents: slice.invoices.collectedCents,
    };
  });
  const invoiceTotal = invoiceRows.reduce(
    (acc, row) => ({
      issued: acc.issued + row.issued,
      paid: acc.paid + row.paid,
      failed: acc.failed + row.failed,
      refunded: acc.refunded + row.refunded,
      collectedCents: acc.collectedCents + row.collectedCents,
    }),
    { issued: 0, paid: 0, failed: 0, refunded: 0, collectedCents: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      <Band section={runRate}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat
            label={itemLabel(runRate, "stat-final-arr")}
            value={usd(model.totals.finalArrCents)}
            hint={finalMonth?.label}
          />
          <Stat
            label={itemLabel(runRate, "stat-target")}
            value={usd(model.params.targetArrCents)}
            hint={pct(model.solve.errorBps)}
          />
          <Stat label={itemLabel(runRate, "stat-mrr")} value={usd(model.totals.finalMrrCents)} />
          <Stat
            label={itemLabel(runRate, "stat-accounts")}
            value={count(model.totals.activeAccounts)}
          />
          <Stat label={itemLabel(runRate, "stat-signups")} value={count(model.totals.signups)} />
          <Stat
            label={itemLabel(runRate, "stat-solve")}
            value={`${(model.solve.acquisitionIndexBps / 10_000).toFixed(2)}×`}
            hint={`${model.solve.passes}`}
          />
        </div>

        <div className="mt-6">
          <ChartContainer config={arrConfig} className="w-full" style={{ height: 280 }}>
            <ComposedChart data={rampData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                height={32}
              />
              <YAxis tickFormatter={compactUsd} tickLine={false} axisLine={false} width={56} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <ReferenceLine
                y={targetDollars}
                stroke="hsl(var(--foreground))"
                strokeDasharray="4 4"
                label={{
                  value: fillLabel(itemLabel(runRate, "marker-target"), {
                    amount: usd(model.params.targetArrCents),
                  }),
                  position: "insideTopLeft",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="arr"
                stroke="var(--color-arr)"
                fill="var(--color-arr)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="var(--color-mrr)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </Band>

      <Band section={retentionBand}>
        <ChartContainer config={retentionConfig} className="w-full" style={{ height: 260 }}>
          <LineChart data={retentionData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="age" tickLine={false} axisLine={false} height={32} />
            <YAxis
              tickFormatter={(value: number) => `${value}%`}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {retentionKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      </Band>

      <Band section={planBand}>
        <ChartContainer config={planConfig} className="w-full" style={{ height: 260 }}>
          <BarChart data={planData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} height={32} />
            <YAxis
              tickFormatter={(value: number) => count(value)}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {model.plans.map((plan) => (
              <Bar
                key={plan.id}
                dataKey={plan.id}
                stackId="accounts"
                fill={`var(--color-${plan.id})`}
                radius={2}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </Band>

      <Band section={churnBand}>
        <ChartContainer config={churnConfig} className="w-full" style={{ height: 240 }}>
          <LineChart data={churnData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} height={32} />
            <YAxis
              tickFormatter={(value: number) => `${value}%`}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="logo"
              stroke="var(--color-logo)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </Band>

      <Band section={invoiceBand}>
        <p className="mb-3 text-xs text-muted-foreground">
          {finalMonth === undefined
            ? ""
            : fillLabel(itemLabel(invoiceBand, "invoice-month"), { month: finalMonth.label })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{invoiceBand.heading}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {itemLabel(invoiceBand, "invoice-plan")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {itemLabel(invoiceBand, "invoice-issued")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {itemLabel(invoiceBand, "invoice-paid")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {itemLabel(invoiceBand, "invoice-failed")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {itemLabel(invoiceBand, "invoice-refunded")}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {itemLabel(invoiceBand, "invoice-collected")}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((row) => (
                <tr key={row.plan} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {row.plan}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">{count(row.issued)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{count(row.paid)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{count(row.failed)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{count(row.refunded)}</td>
                  <td className="py-2 text-right tabular-nums">{usd(row.collectedCents)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {itemLabel(invoiceBand, "invoice-total")}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{count(invoiceTotal.issued)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{count(invoiceTotal.paid)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{count(invoiceTotal.failed)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {count(invoiceTotal.refunded)}
                </td>
                <td className="py-2 text-right tabular-nums">{usd(invoiceTotal.collectedCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Band>

      <p className="text-xs text-muted-foreground">
        {fillLabel(pageItemOf(copy, "footer-provenance").label, {
          command: model.generatedBy,
          cohorts: count(model.cohorts.length),
          churned: count(model.totals.churnedAccounts),
          failed: count(model.totals.failedInvoices),
          refunded: count(model.totals.refundedInvoices),
        })}
      </p>
    </div>
  );
}

/**
 * The artifact is missing or unreadable — the page's one failure state.
 *
 * A panel with the reason, never a page of zeroes: the difference between "this business made no
 * money" and "nobody could read the file" is the whole job of this screen.
 */
export function GrowthConsoleUnreadable({ copy, reason }: { copy: PageCopy; reason: string }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader className="flex flex-row items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden />
        <div>
          <CardTitle>{pageItemOf(copy, "unreadable-heading").label}</CardTitle>
          <CardDescription>
            {fillLabel(pageItemOf(copy, "unreadable-body").label, { reason })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {pageItemOf(copy, "unreadable-action").label}
        </p>
      </CardContent>
    </Card>
  );
}
