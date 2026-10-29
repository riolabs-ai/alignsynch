/**
 * metric-fixture tests — the computed delta, the formatters, and the invariants that keep a
 * table of numbers honest.
 *
 * The point of the card is the first describe block: a delta is read off two values, so
 * editing `previous` in `data/metrics.ts` changes the rendered string with no `.tsx` edit.
 * The cases assert that property directly (two snapshots, two strings, same code path) rather
 * than trusting the number that happens to be in the fixture today.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deltaOf,
  formatCompactCount,
  formatCompactCurrency,
  formatCount,
  formatCountRange,
  formatCurrencyAmount,
  formatDayCount,
  formatDeltaWithPeriod,
  formatMetricDelta,
  formatMetricValue,
  formatPercentRange,
  formatPercentValue,
  formatPeriodPhrase,
  formatWholeCurrency,
  progressPercentOf,
  sharePercentOf,
  zMetricSnapshot,
  type MetricSnapshot,
} from "../../content/metrics";
import { affiliateTiers, earningSources, metricTable, streakRewards } from "../../data/metrics";
import {
  breakdownProblems,
  metricKeyProblems,
  rangeProblems,
  renderedTableKeys,
  streakRewardProblems,
  tierBandProblems,
  unusedMetricKeys,
} from "../metric-invariants";

const snapshot = (overrides: Partial<MetricSnapshot> = {}): MetricSnapshot => ({
  unit: "count",
  value: 10,
  period: "allTime",
  ...overrides,
});

describe("deltaOf — a change is computed, never authored", () => {
  it("subtracts the previous period from the current one", () => {
    const delta = deltaOf(snapshot({ value: 24, previous: 20, period: "month" }));
    assert.ok(delta);
    assert.equal(delta.absolute, 4);
    assert.equal(delta.percent, 20);
  });

  it("has no delta without a previous period", () => {
    assert.equal(deltaOf(snapshot({ value: 24 })), undefined);
  });

  it("has no percent change from nothing", () => {
    const delta = deltaOf(snapshot({ value: 5, previous: 0, period: "month" }));
    assert.ok(delta);
    assert.equal(delta.absolute, 5);
    assert.equal(delta.percent, undefined);
  });

  it("reports a fall as a negative change", () => {
    const delta = deltaOf(snapshot({ value: 8, previous: 10, period: "month" }));
    assert.equal(delta?.absolute, -2);
    assert.equal(delta?.percent, -20);
  });
});

describe("the rendered delta moves when the fixture moves", () => {
  it("renders two different strings for two different snapshots, same code path", () => {
    const before = snapshot({ value: 24, previous: 20, period: "month" });
    const after = snapshot({ value: 30, previous: 20, period: "month" });
    assert.equal(formatDeltaWithPeriod(before), "+4 from last month");
    assert.equal(formatDeltaWithPeriod(after), "+10 from last month");
  });

  it("renders a percent change with one decimal, trimming a trailing zero", () => {
    assert.equal(
      formatMetricDelta(snapshot({ value: 24, previous: 20, period: "month", delta: "percent" })),
      "+20%",
    );
    assert.equal(
      formatMetricDelta(
        snapshot({
          unit: "currency",
          value: 12_450,
          previous: 11_116,
          period: "month",
          delta: "percent",
        }),
      ),
      "+12%",
    );
    assert.equal(
      formatMetricDelta(
        snapshot({ unit: "percent", value: 78.3, previous: 76.2, period: "month" }),
      ),
      "+2.1%",
    );
  });

  it("renders nothing at all when there is no history", () => {
    assert.equal(formatMetricDelta(snapshot({ value: 24 })), "");
    assert.equal(formatDeltaWithPeriod(snapshot({ value: 24 })), "");
  });
});

describe("formatters — the only place a number becomes a string", () => {
  it("groups counts", () => {
    assert.equal(formatCount(1248), "1,248");
    assert.equal(formatCount(0), "0");
    assert.equal(formatCount(573), "573");
  });

  it("compresses magnitudes in either casing", () => {
    assert.equal(formatCompactCount(10_000), "10k");
    assert.equal(formatCompactCount(10_000, "upper"), "10K");
    assert.equal(formatCompactCount(2_500), "2.5k");
    assert.equal(formatCompactCount(1_000_000), "1M");
    assert.equal(formatCompactCurrency(100_000_000), "$1M");
  });

  it("keeps cents on a price and drops them on a prize", () => {
    assert.equal(formatCurrencyAmount(12_450), "$124.50");
    assert.equal(formatCurrencyAmount(999), "$9.99");
    assert.equal(formatWholeCurrency(500_000), "$5,000");
    assert.equal(formatWholeCurrency(1_000), "$10");
  });

  it("trims a whole percent and keeps a decimal", () => {
    assert.equal(formatPercentValue(30), "30%");
    assert.equal(formatPercentValue(78.3), "78.3%");
    assert.equal(formatPercentValue(62.85), "62.9%");
    assert.equal(formatPercentValue(11.1), "11.1%");
  });

  it("renders a day count in both the badge and the sentence vocabulary", () => {
    assert.equal(formatDayCount(4), "4 days");
    assert.equal(formatDayCount(4, "upper"), "4 Days");
    assert.equal(formatDayCount(1), "1 day");
  });

  it("renders a range with the open end as a plus", () => {
    assert.equal(formatCountRange(0, 24), "0-24");
    assert.equal(formatCountRange(100), "100+");
    assert.equal(formatPercentRange(10, 20), "10-20%");
  });

  it("dispatches on the unit, so a widget never picks a format", () => {
    assert.equal(formatMetricValue(snapshot({ unit: "currency", value: 12_450 })), "$124.50");
    assert.equal(formatMetricValue(snapshot({ unit: "percent", value: 78.3 })), "78.3%");
    assert.equal(formatMetricValue(snapshot({ unit: "count", value: 1_248 })), "1,248");
    assert.equal(formatMetricValue(snapshot({ unit: "coins", value: 500 })), "500");
    assert.equal(formatMetricValue(snapshot({ unit: "days", value: 4 })), "4 days");
    assert.equal(formatMetricValue(snapshot({ unit: "seconds", value: 252 })), "4m 12s");
  });

  it("derives a period phrase from the period, never from the copy", () => {
    assert.equal(formatPeriodPhrase("month"), "from last month");
    assert.equal(formatPeriodPhrase("week"), "from last week");
    assert.equal(formatPeriodPhrase("day"), "from yesterday");
    assert.equal(formatPeriodPhrase("allTime"), "");
  });

  it("has no ratio against a zero whole", () => {
    assert.equal(sharePercentOf(5, 0), 0);
    assert.equal(sharePercentOf(7_825, 12_450), 62.9);
    assert.equal(progressPercentOf(124_050, 165_400), 75);
  });

  it("keeps a bar's fill exact — rounding belongs to the label, not the geometry", () => {
    // `/leaderboard`'s 3,250 / 4,000 points bar was `value={81.25}`. A one-decimal bar would
    // render 81.3 and move the fill by 0.05 points; the exact ratio keeps the pixel identical.
    assert.equal(progressPercentOf(3_250, 4_000), 81.25);
    assert.equal(formatPercentValue(progressPercentOf(3_250, 4_000)), "81.3%");
  });
});

describe("the schema refuses a snapshot that cannot be rendered honestly", () => {
  const parse = (value: unknown) => zMetricSnapshot.safeParse(value);

  it("accepts the fixture's own shape", () => {
    assert.equal(parse(snapshot({ value: 24, previous: 20, period: "month" })).success, true);
  });

  it("rejects a percent outside 0..100", () => {
    assert.equal(parse(snapshot({ unit: "percent", value: 140 })).success, false);
  });

  it("rejects fractional cents", () => {
    assert.equal(parse(snapshot({ unit: "currency", value: 12.5 })).success, false);
  });

  it("rejects a delta mode with nothing to compare against", () => {
    assert.equal(parse(snapshot({ delta: "percent" })).success, false);
  });

  it("rejects a previous value on an all-time total", () => {
    assert.equal(parse(snapshot({ value: 10, previous: 8, period: "allTime" })).success, false);
  });
});

describe("the shipped fixture keeps its own invariants", () => {
  it("every key is owner.name", () => {
    assert.deepEqual(metricKeyProblems(metricTable), []);
  });

  it("the earnings breakdown adds up to the balance", () => {
    const total = metricTable["dashboard.balance"].value;
    const rows = earningSources.map((source) => ({
      label: source.label,
      amountCents: metricTable[source.amount].value,
      sharePct: source.sharePct,
    }));
    assert.deepEqual(breakdownProblems(total, rows), []);
  });

  it("the tier bands tile without a gap and climb", () => {
    assert.deepEqual(
      tierBandProblems(
        affiliateTiers.map((tier) => ({
          id: tier.id,
          from: tier.from,
          to: tier.to,
          ratePct: metricTable[tier.rate].value,
        })),
      ),
      [],
    );
  });

  it("streak rewards climb and say one thing each", () => {
    assert.deepEqual(streakRewardProblems(streakRewards), []);
  });

  it("the group battle range is closed", () => {
    assert.deepEqual(
      rangeProblems(
        "the group battle player range",
        metricTable["battle.group.minPlayers"].value,
        metricTable["battle.group.maxPlayers"].value,
      ),
      [],
    );
  });

  it("renders the deltas the card was written for", () => {
    assert.equal(formatDeltaWithPeriod(metricTable["dashboard.quizzes"]), "+4 from last month");
    assert.equal(formatDeltaWithPeriod(metricTable["dashboard.players"]), "+118 from last month");
    assert.equal(
      formatDeltaWithPeriod(metricTable["dashboard.completionRate"]),
      "+2.1% from last month",
    );
    assert.equal(formatMetricValue(metricTable["dashboard.balance"]), "$124.50");
    assert.equal(formatMetricDelta(metricTable["dashboard.balance"]), "+12%");
    assert.equal(formatMetricDelta(metricTable["affiliate.thisMonth"]), "+12.5%");
  });
});

describe("invariants have negative cases", () => {
  it("flags a breakdown whose parts do not sum to its total", () => {
    const problems = breakdownProblems(100, [
      { label: "a", amountCents: 40, sharePct: 40 },
      { label: "b", amountCents: 50, sharePct: 50 },
    ]);
    /** Two findings, because the missing 10 cents also leaves the shares 10 points short. */
    assert.equal(problems.length, 2);
    assert.match(problems[0], /sum to 90 cents but the total is 100/);
    assert.match(problems[1], /sum to 90%/);
  });

  it("flags a share that disagrees with its amount", () => {
    const problems = breakdownProblems(100, [
      { label: "a", amountCents: 40, sharePct: 40 },
      { label: "b", amountCents: 60, sharePct: 70 },
    ]);
    assert.equal(problems.length, 2);
    assert.match(problems[1], /claims 70%/);
  });

  it("accepts a share that is rounded to a tenth of a point", () => {
    /** 7 825 / 12 450 = 62.85 %: the page truncates to 62.8 and that is rounding, not a lie. */
    assert.deepEqual(
      breakdownProblems(12_450, [
        { label: "quiz plays", amountCents: 7_825, sharePct: 62.8 },
        { label: "commissions", amountCents: 3_250, sharePct: 26.1 },
        { label: "premium", amountCents: 1_375, sharePct: 11.1 },
      ]),
      [],
    );
  });

  it("flags a tier band with a gap, an overlap and a backwards rate", () => {
    const gap = tierBandProblems([
      { id: "a", from: 0, to: 10, ratePct: 20 },
      { id: "b", from: 12, to: 20, ratePct: 25 },
    ]);
    /** Two findings: the gap, and the closed top tier (20 is not open-ended). */
    assert.equal(gap.length, 2);
    assert.match(gap[0], /must tile without a gap or an overlap/);

    const overlap = tierBandProblems([
      { id: "a", from: 0, to: 15, ratePct: 20 },
      { id: "b", from: 10, to: 20, ratePct: 15 },
    ]);
    assert.equal(overlap.length, 3);
    assert.ok(overlap.some((problem) => /cannot pay less/.test(problem)));
    assert.ok(overlap.some((problem) => /must tile without a gap or an overlap/.test(problem)));
    assert.ok(overlap.some((problem) => /top tier "b" is closed/.test(problem)));

    assert.match(
      tierBandProblems([{ id: "a", from: 0, to: 10, ratePct: 20 }])[0],
      /top tier "a" is closed/,
    );
    assert.match(tierBandProblems([{ id: "a", from: 3, to: 10, ratePct: 20 }])[0], /starts at 3/);
  });

  it("flags streak rewards out of order or carrying two rewards", () => {
    assert.equal(
      streakRewardProblems([
        { days: 5, coins: 10 },
        { days: 3, coins: 20 },
      ]).length,
      1,
    );
    assert.match(
      streakRewardProblems([{ days: 3, coins: 10, label: "Two" }])[0],
      /must carry a coin amount or a label/,
    );
  });

  it("flags a range that is not a range", () => {
    assert.equal(rangeProblems("the range", 10, 3).length, 1);
  });

  it("flags a key nothing renders, and accepts one a rendered table points at", () => {
    const table = { "a.b": snapshot() };
    const sources = [{ path: "components/x.tsx", source: "const x = 1;" }];
    assert.equal(unusedMetricKeys(table, sources).length, 1);
    assert.deepEqual(
      unusedMetricKeys(
        table,
        sources,
        renderedTableKeys([{ name: "tiers", keys: ["a.b"] }], sources),
      ),
      [
        'metric "a.b" is in data/metrics.ts but no component or route renders it — a snapshot nothing reads is fixture drift (delete it, or wire the surface that needs it)',
      ],
    );
    /** The table only counts once the UI imports it. */
    const imported = [
      { path: "components/x.tsx", source: 'import { tiers } from "@/data/metrics";' },
    ];
    assert.deepEqual(
      unusedMetricKeys(
        table,
        imported,
        renderedTableKeys([{ name: "tiers", keys: ["a.b"] }], imported),
      ),
      [],
    );
  });

  it("flags a key that does not name an owner and a measure", () => {
    assert.equal(metricKeyProblems({ balance: snapshot() }).length, 1);
    assert.deepEqual(metricKeyProblems({ "owner.measure": snapshot() }), []);
  });
});
