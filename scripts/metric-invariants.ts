/**
 * metric-invariants — the rules a fixture full of numbers has to keep (E25).
 *
 * `content/metrics.ts` proves one snapshot is well-formed. It cannot see the three things a
 * *table* of them gets wrong, and all three shipped in the P1 tree as typed JSX:
 *
 *   shape     a key that is not `owner.name` — a number with no surface and no meaning;
 *   usage     a snapshot nothing renders. Fixture drift starts as one dead record, and a
 *             record nothing reads can never be caught by rendering it;
 *   arithmetic a total that does not equal its parts (`$124.50` vs `$78.25 + $32.50 + $13.75`),
 *             shares that do not sum to 100, tiers whose bands leave a gap, streak rewards out
 *             of order. The dashboard asserted `62.8% / 26.1% / 11.1%` beside three amounts —
 *             consistent arithmetic by luck, and nothing checked it.
 *
 * Kept pure so `scripts/__tests__/metric-fixture.test.ts` can break each rule on purpose: an
 * invariant that only ever passes proves nothing.
 */
import type { MetricSnapshot } from "../content/metrics";
import type { SourceFile } from "./ui-refs";

/** `owner.name`, at least two segments, each `[a-z][a-zA-Z0-9]*`. */
const METRIC_KEY = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/;

/** A key nothing renders. `sources` is the UI tree, compiled to the literals it contains. */
export function unusedMetricKeys(
  table: Readonly<Record<string, MetricSnapshot>>,
  sources: SourceFile[],
  /** Keys a rendered *table* points at — `affiliateTiers[i].rate` and friends. */
  tableKeys: ReadonlySet<string> = new Set(),
): string[] {
  const literals = new Set<string>();
  for (const file of sources) {
    for (const match of file.source.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'/g)) {
      literals.add(match[1] ?? match[2] ?? "");
    }
  }
  return Object.keys(table)
    .filter((key) => !literals.has(key) && !tableKeys.has(key))
    .sort()
    .map(
      (key) =>
        `metric "${key}" is in data/metrics.ts but no component or route renders it — a snapshot nothing reads is fixture drift (delete it, or wire the surface that needs it)`,
    );
}

/** A fixture table whose rows name snapshots by key (`affiliateTiers`, `earningSources`, …). */
export interface LiteralTable {
  /** The identifier a component must import for the table's keys to count as rendered. */
  name: string;
  keys: readonly string[];
}

/**
 * The keys a *table* points at, for tables the UI actually imports.
 *
 * A tier's rate (`affiliate.tier.basic`) is never written as a literal in a component — the
 * component maps the table and reads `tier.rate`. Without this hop the usage rule would flag
 * every table-driven snapshot as dead, which is the opposite of true. The hop only counts when
 * the table's own identifier appears in the UI, so a table nobody imports still fails the rule
 * through its keys.
 */
export function renderedTableKeys(
  tables: readonly LiteralTable[],
  sources: SourceFile[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const table of tables) {
    const pattern = new RegExp(`\\b${table.name}\\b`);
    if (!sources.some((file) => pattern.test(file.source))) continue;
    for (const key of table.keys) keys.add(key);
  }
  return keys;
}

/** Every key names a surface and a measure. */
export function metricKeyProblems(table: Readonly<Record<string, MetricSnapshot>>): string[] {
  return Object.keys(table)
    .filter((key) => !METRIC_KEY.test(key))
    .map(
      (key) =>
        `metric key "${key}" is not \`owner.name\` (lowercase, dotted, at least two segments) — the owner is the surface or programme, the name is what it measures`,
    );
}

/** One row of a breakdown: an amount plus the share of the total it claims. */
export interface BreakdownRow {
  label: string;
  amountCents: number;
  sharePct: number;
}

/** Rows that add up: the cents sum to the total, the shares to 100, each share to its amount. */
export function breakdownProblems(totalCents: number, rows: readonly BreakdownRow[]): string[] {
  const problems: string[] = [];
  if (rows.length === 0) return ["a breakdown with no rows claims a total nothing supports"];

  const sum = rows.reduce((acc, row) => acc + row.amountCents, 0);
  if (sum !== totalCents) {
    problems.push(
      `the breakdown's amounts sum to ${sum} cents but the total is ${totalCents} — one of the two is invented`,
    );
  }

  const shareSum = Math.round(rows.reduce((acc, row) => acc + row.sharePct, 0) * 10) / 10;
  if (Math.abs(shareSum - 100) > 0.15) {
    problems.push(`the breakdown's shares sum to ${shareSum}%, not 100%`);
  }

  for (const row of rows) {
    if (totalCents === 0) continue;
    // The authored share is truncated/rounded by whoever wrote the page; anything beyond a
    // tenth of a point is not rounding, it is a different number.
    const actual = (row.amountCents / totalCents) * 100;
    if (Math.abs(actual - row.sharePct) > 0.1) {
      problems.push(
        `"${row.label}" claims ${row.sharePct}% of ${totalCents} cents but its amount is ${((actual * 100) | 0) / 100}% — the share and the amount disagree`,
      );
    }
  }
  return problems;
}

/** A commission tier band: `from`, and `to` on every tier but the open-ended top one. */
export interface TierBand {
  id: string;
  from: number;
  to?: number;
  ratePct: number;
}

/** Bands that tile `0..` without a gap, overlap or a rate that goes backwards. */
export function tierBandProblems(tiers: readonly TierBand[]): string[] {
  const problems: string[] = [];
  if (tiers.length === 0) return ["no commission tiers: the badges have nothing to render"];

  const sorted = [...tiers].sort((a, b) => a.from - b.from);
  if (sorted[0].from !== 0) {
    problems.push(`the first tier starts at ${sorted[0].from}, so referrals below it earn nothing`);
  }
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    if (tier.to !== undefined && tier.to < tier.from) {
      problems.push(`tier "${tier.id}" ends (${tier.to}) before it starts (${tier.from})`);
    }
    const next = sorted[i + 1];
    if (next === undefined) {
      if (tier.to !== undefined) {
        problems.push(
          `the top tier "${tier.id}" is closed at ${tier.to}: referrals above it earn nothing`,
        );
      }
      continue;
    }
    if (tier.to === undefined) {
      problems.push(`tier "${tier.id}" is open-ended but "${next.id}" starts after it`);
      continue;
    }
    if (next.from !== tier.to + 1) {
      problems.push(
        `tier band "${tier.id}" ends at ${tier.to} and "${next.id}" starts at ${next.from}: the band must tile without a gap or an overlap`,
      );
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].ratePct < sorted[i - 1].ratePct) {
      problems.push(
        `tier "${sorted[i].id}" pays ${sorted[i].ratePct}% after "${sorted[i - 1].id}" pays ${sorted[i - 1].ratePct}%: a higher tier cannot pay less`,
      );
    }
  }
  return problems;
}

/** A streak reward band: a day threshold, and exactly one of a coin amount or a label. */
export interface RewardBand {
  days: number;
  coins?: number;
  label?: string;
}

/** Rewards that climb, and that say one thing per band. */
export function streakRewardProblems(rewards: readonly RewardBand[]): string[] {
  const problems: string[] = [];
  if (rewards.length === 0) return ["no streak rewards: the reward grid has nothing to render"];

  for (let i = 0; i < rewards.length; i++) {
    const reward = rewards[i];
    if (reward.days < 1) problems.push(`a streak reward at ${reward.days} days is unreachable`);
    if ((reward.coins === undefined) === (reward.label === undefined)) {
      problems.push(
        `streak reward at ${reward.days} days must carry a coin amount or a label, not both/neither`,
      );
    }
    const previous = rewards[i - 1];
    if (previous && reward.days <= previous.days) {
      problems.push(
        `streak rewards are out of order: ${previous.days} days precedes ${reward.days} days`,
      );
    }
  }
  return problems;
}

/** A closed range: `min` below `max`. */
export function rangeProblems(label: string, min: number, max: number): string[] {
  return min < max
    ? []
    : [`${label} is ${min}-${max}: the lower bound must be below the upper one`];
}
