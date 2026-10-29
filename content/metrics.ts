/**
 * Metrics — the numbers a surface asserts, and the only place a number becomes a string.
 *
 * The failure this replaces: 69 rendered quantities in `components/**` and `app/**` that no
 * fixture produced (`docs/P2-INVENTORY.md` WU-4, issue #49). `+4 from last month` was six
 * characters of JSX, so nothing could disagree with it — not a schema, not a fixture, not a
 * gate. A dashboard could claim a 12% month, a 78.3% completion rate and $124.50 while the
 * analytics entity held per-quiz completion only. The shape of the defect, not the numbers,
 * is what this module fixes:
 *
 *   1. a **delta is computed** — `previous` + `value`, never an authored `+4` — so a change
 *      against a period with no snapshot cannot be rendered at all (`deltaOf` returns
 *      `undefined` when `previous` is absent, and E25 rejects a delta mode without one);
 *   2. a **value has a unit** — `percent`, `currency` (integer cents, like every other money
 *      value in this model), `count`, `coins`, `xp`, `players`, `days` — so the formatter,
 *      not the JSX author, decides the shape;
 *   3. **formatting is pure** — every function below is a pure function of the snapshot.
 *      No `new Date()`, no `toLocale*` on the render path: the same record renders the same
 *      bytes on the server and in the browser (the React #418 rule in AGENTS.md).
 *
 * Keys are `owner.name` (`dashboard.balance`, `affiliate.maxCommission`). The owner is the
 * surface or the programme the number describes; the name is what it measures. `(owner,
 * period)` is the identity the issue asked for: two snapshots of the same metric in different
 * periods are two keys (`wallet.thisMonth` vs `wallet.lifetime`), and a delta always compares
 * `value` against `previous` *within one record*, never across two.
 *
 * One declared disagreement lives in the fixture, not in this schema: `/pricing` says the
 * annual plan saves 20% and `/settings` says 16%. Two surfaces, one concept, two numbers —
 * that is a product decision (follow-up card), so both survive as separate snapshots and the
 * schema does not pretend they are one field. See `data/metrics.ts`.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * The snapshot
 * ------------------------------------------------------------------ */

/**
 * The natural unit of a value. The unit decides the formatter, which is why it is required:
 * `12450` is `$124.50` or `12,450` depending on it, and a schema that let the caller decide
 * would put the format back in the JSX.
 */
export const METRIC_UNITS = [
  "count",
  "percent",
  "currency",
  "coins",
  "xp",
  "players",
  "days",
  "seconds",
] as const;

/** The window a value covers. `allTime` has no previous period, so it can carry no delta. */
export const METRIC_PERIODS = ["allTime", "day", "week", "month", "year"] as const;

/** How a change against `previous` is rendered: `+4` or `+12%`. */
export const METRIC_DELTA_MODES = ["absolute", "percent"] as const;

export const zMetricUnit = z.enum(METRIC_UNITS);
export const zMetricPeriod = z.enum(METRIC_PERIODS);
export const zMetricDeltaMode = z.enum(METRIC_DELTA_MODES);

export const zMetricSnapshot = z
  .object({
    unit: zMetricUnit,
    /** The current period's value: cents for `currency`, points for `percent`, else a count. */
    value: z.number(),
    period: zMetricPeriod,
    /**
     * The comparable previous period's value. Absent means "no history": the surface renders
     * the value and no delta, which is the only honest rendering of a first month.
     */
    previous: z.number().optional(),
    /** How the delta reads when `previous` is present. Absent means `absolute`. */
    delta: zMetricDeltaMode.optional(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (snapshot.unit === "percent" && (snapshot.value < 0 || snapshot.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `a percent value is 0..100, got ${snapshot.value}`,
      });
    }
    if (snapshot.unit === "percent" && snapshot.previous !== undefined) {
      if (snapshot.previous < 0 || snapshot.previous > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["previous"],
          message: `a percent previous value is 0..100, got ${snapshot.previous}`,
        });
      }
    }
    if (snapshot.unit === "currency" && !Number.isInteger(snapshot.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `currency is integer cents, got ${snapshot.value}`,
      });
    }
    if (
      snapshot.unit === "currency" &&
      snapshot.previous !== undefined &&
      !Number.isInteger(snapshot.previous)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["previous"],
        message: `currency is integer cents, got ${snapshot.previous}`,
      });
    }
    if (snapshot.previous === undefined && snapshot.delta === "percent") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delta"],
        message: "a delta mode needs a `previous` value to compare against",
      });
    }
    if (snapshot.previous !== undefined && snapshot.period === "allTime") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["period"],
        message: "`allTime` has no previous period to compare against",
      });
    }
  });

/** The whole fixture: `owner.name` -> snapshot. A key that names nothing is a dead metric. */
export const zMetricTable = z.record(z.string(), zMetricSnapshot);

export type MetricUnit = z.infer<typeof zMetricUnit>;
export type MetricPeriod = z.infer<typeof zMetricPeriod>;
export type MetricDeltaMode = z.infer<typeof zMetricDeltaMode>;
export type MetricSnapshot = z.infer<typeof zMetricSnapshot>;
export type MetricTable = z.infer<typeof zMetricTable>;

/* ------------------------------------------------------------------ *
 * Selectors — the computed half
 * ------------------------------------------------------------------ */

export interface MetricDelta {
  /** `value - previous`, in the metric's own unit (points for percent, cents for currency). */
  absolute: number;
  /**
   * Percent change against `previous`. `undefined` when there is no history — and when
   * `previous` is 0, because a change from nothing has no ratio (it is not "100%").
   */
  percent: number | undefined;
}

/**
 * The change a snapshot claims, computed from the two values it carries.
 *
 * This is the function the card exists for: `+4 from last month` is not authored anywhere,
 * it is `deltaOf(metricSnapshots["dashboard.quizzes"])`. With no `previous`, there is no
 * delta — never a zero, never a hundred percent.
 */
export function deltaOf(snapshot: MetricSnapshot): MetricDelta | undefined {
  if (snapshot.previous === undefined) return undefined;
  const absolute = snapshot.value - snapshot.previous;
  const percent = snapshot.previous === 0 ? undefined : (absolute / snapshot.previous) * 100;
  return { absolute, percent };
}

/** `(part / whole) * 100`, one decimal. The share a breakdown row renders. */
export function sharePercentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : round1((part / whole) * 100);
}

/**
 * `(part / whole) * 100`, unrounded. A bar's fill is geometry, not copy: rounding it to one
 * decimal (`81.25` -> `81.3`) moves the rendered width, so the exact ratio stays exact and
 * only the formatter (`formatPercentValue`) rounds what a human reads.
 */
export function progressPercentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------ *
 * Formatting — the only place a number becomes a string
 * ------------------------------------------------------------------ */

const GROUPED = new Intl.NumberFormat("en-US");
const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const WHOLE_CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const MAGNITUDE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** `1248` -> `1,248`. A count keeps its thousands separator. */
export function formatCount(value: number): string {
  return GROUPED.format(value);
}

/**
 * `10000` -> `10k` / `10K`, `100000000` -> `1M`. A compressed count.
 *
 * `casing` exists because the tree writes both (`10k+` on `/affiliate`, `10K+` on `/login`),
 * and a formatter that picked one would have changed rendered output on the other.
 */
export function formatCompactCount(value: number, casing: "lower" | "upper" = "lower"): string {
  const suffix = value >= 1_000_000 ? "M" : value >= 1_000 ? "k" : "";
  const scaled = suffix === "M" ? value / 1_000_000 : suffix === "k" ? value / 1_000 : value;
  const digits = suffix === "" ? String(scaled) : MAGNITUDE.format(scaled);
  if (suffix === "") return digits;
  return `${digits}${casing === "upper" ? suffix.toUpperCase() : suffix}`;
}

/** `100000` cents ($1,000) -> `$1k`. A compressed money total, same casing rule as counts. */
export function formatCompactCurrency(cents: number, casing: "lower" | "upper" = "lower"): string {
  return `$${formatCompactCount(cents / 100, casing)}`;
}

/** `12450` cents -> `$124.50`. Two decimals, always: a price is not "rounded". */
export function formatCurrencyAmount(cents: number): string {
  return CURRENCY.format(cents / 100);
}

/** `500000` cents -> `$5,000`. Whole dollars with a separator — a prize pool, not a price. */
export function formatWholeCurrency(cents: number): string {
  return WHOLE_CURRENCY.format(cents / 100);
}

/** `78.3` -> `78.3%`, `30` -> `30%`, `12` -> `12%`. One decimal, trimmed when whole. */
export function formatPercentValue(value: number): string {
  return `${round1(value)}%`;
}

/** `4` -> `4 days` / `4 Days`. The badge vocabulary capitalises; body copy does not. */
export function formatDayCount(days: number, casing: "lower" | "upper" = "lower"): string {
  const unit = days === 1 ? "day" : "days";
  return `${formatCount(days)} ${casing === "upper" ? `${unit[0].toUpperCase()}${unit.slice(1)}` : unit}`;
}

/** `252` seconds -> `4m 12s`. Compact, zero-padded seconds, no locale. */
export function formatCompactDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/** `0..24` -> `0-24`; an open-ended top -> `100+`. A tier's referral band. */
export function formatCountRange(from: number, to?: number): string {
  return to === undefined ? `${formatCount(from)}+` : `${formatCount(from)}-${formatCount(to)}`;
}

/** `10, 20` -> `10-20%`. A range of proportions. */
export function formatPercentRange(from: number, to: number): string {
  return `${round1(from)}-${formatPercentValue(to)}`;
}

/**
 * The value with its unit, as the surface renders it.
 *
 * `formatMetricValue` is the one function a widget calls for a number; the unit decides the
 * shape, so `venue: "$1M+"` becomes `formatCompactCount` on a currency unit rather than a
 * second code path in the JSX.
 */
export function formatMetricValue(snapshot: MetricSnapshot): string {
  switch (snapshot.unit) {
    case "currency":
      return formatCurrencyAmount(snapshot.value);
    case "percent":
      return formatPercentValue(snapshot.value);
    case "days":
      return formatDayCount(snapshot.value);
    case "seconds":
      return formatCompactDuration(snapshot.value);
    default:
      return formatCount(snapshot.value);
  }
}

/**
 * `+4`, `+12%`, `-3`. Empty when the snapshot has no history — a surface renders nothing
 * rather than inventing a direction.
 *
 * The sign is explicit: a change is always rendered signed, because an unsigned `4` reads as
 * a value, not as a delta.
 */
export function formatMetricDelta(snapshot: MetricSnapshot): string {
  const delta = deltaOf(snapshot);
  if (!delta) return "";
  const sign = delta.absolute >= 0 ? "+" : "-";
  if ((snapshot.delta ?? "absolute") === "percent") {
    if (delta.percent === undefined) return "";
    return `${sign}${formatPercentValue(Math.abs(delta.percent))}`;
  }
  const magnitude =
    snapshot.unit === "currency"
      ? formatCurrencyAmount(Math.abs(delta.absolute))
      : snapshot.unit === "percent"
        ? formatPercentValue(Math.abs(delta.absolute))
        : formatCount(Math.abs(delta.absolute));
  return `${sign}${magnitude}`;
}

/** `from last month`, `from last week`, `from yesterday`. Empty for `allTime`. */
export function formatPeriodPhrase(period: MetricPeriod): string {
  switch (period) {
    case "day":
      return "from yesterday";
    case "week":
      return "from last week";
    case "month":
      return "from last month";
    case "year":
      return "from last year";
    default:
      return "";
  }
}

/** `+4 from last month` — the whole phrase a delta line renders, in one call. */
export function formatDeltaWithPeriod(snapshot: MetricSnapshot): string {
  const delta = formatMetricDelta(snapshot);
  const phrase = formatPeriodPhrase(snapshot.period);
  if (delta.length === 0 || phrase.length === 0) return delta;
  return `${delta} ${phrase}`;
}
