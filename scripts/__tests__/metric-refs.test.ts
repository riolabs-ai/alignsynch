/**
 * metric-refs tests — the E22 rule, before and after the tree it was written on.
 *
 * Every positive case below is a node that shipped on `main` (issue #49, WU-4): `+4 from last
 * month`, `$124.50`, `Save 20%`, `500 Coins`. Every negative case is a shape the rule must
 * *not* fire on, because a scanner that flags `className="w-4 h-4"` or `{formatCurrency(cents)}`
 * would be turned off instead of fixed.
 *
 * The load-bearing negative is `renders a value through an expression`: the fix is a component
 * that computes, and the rule has to be blind to its own remedy. If that case ever fails, the
 * gate would push people back to literals.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collapseWhitespace,
  durationLabels,
  findMetricLiterals,
  metricKindOf,
  relativeLabels,
  type MetricLiteral,
} from "../metric-refs";

const file = (source: string, path = "components/x.tsx") => [{ path, source }];
const only = (source: string): MetricLiteral[] => findMetricLiterals(file(source));

describe("metricKindOf", () => {
  it("classifies each clause of the rule", () => {
    assert.equal(metricKindOf("78.3%"), "percent");
    assert.equal(metricKindOf("$124.50"), "money");
    assert.equal(metricKindOf("+4 from last month"), "delta");
    assert.equal(metricKindOf("Save 20%"), "percent");
    assert.equal(metricKindOf("10k+"), "magnitude");
    assert.equal(metricKindOf("$1M+"), "money");
    assert.equal(metricKindOf("500 Coins"), "quantity");
    assert.equal(metricKindOf("1,248 participants"), "quantity");
    assert.equal(metricKindOf("3-10 players"), "quantity");
    assert.equal(metricKindOf("Top 15% of participants"), "percent");
  });

  it("returns nothing for copy a fixture does not own", () => {
    assert.equal(metricKindOf("Total Balance"), undefined);
    assert.equal(metricKindOf("Play for free"), undefined);
    assert.equal(metricKindOf("Your rank"), undefined);
    /** A bare number has no unit: indistinguishable from chrome (pagination, a step index). */
    assert.equal(metricKindOf("42"), undefined);
    assert.equal(metricKindOf("1v1 Battle"), undefined);
    /** A phone number opens with `+`, which is not a delta. */
    assert.equal(metricKindOf("+1 (555) 123-4567"), undefined);
  });

  it("leaves relative instants to the fixture clock", () => {
    assert.equal(metricKindOf("2 hours ago"), undefined);
    assert.equal(metricKindOf("in 3 days"), undefined);
    /** The instant is stripped, the neighbouring value is still a metric. */
    assert.equal(metricKindOf("3 days ago · 45% lift"), "percent");
  });

  it("leaves durations to the control or the window that owns them", () => {
    assert.equal(metricKindOf("5 seconds"), undefined);
    assert.equal(metricKindOf("Last 30 days"), undefined);
    assert.equal(metricKindOf("4m 12s"), undefined);
    assert.equal(metricKindOf("28 days left"), undefined);
  });

  it("collapses whitespace so a diagnostic and a test agree", () => {
    assert.equal(collapseWhitespace("\n   Earn up to\n   30%\n"), "Earn up to 30%");
  });
});

describe("findMetricLiterals", () => {
  it("finds a rendered value in JSX text and reports its line", () => {
    const found = only(
      `export function X() {\n  return (\n    <p>\n      +4 from last month\n    </p>\n  );\n}`,
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].line, 4);
    assert.equal(found[0].kind, "delta");
    assert.equal(found[0].value, "+4 from last month");
  });

  it("finds a value in a display attribute and in a string expression", () => {
    const found = only(
      `export function X() {\n  return <Badge label="Save 20%">{"30% off"}</Badge>;\n}`,
    );
    assert.deepEqual(
      found.map((literal) => literal.value),
      ["Save 20%", "30% off"],
    );
  });

  it("ignores class lists, hrefs and ids", () => {
    const found = only(
      `export function X() {\n  return <div className="w-4 h-4 grid-cols-3" id="step-2" />;\n}`,
    );
    assert.deepEqual(found, []);
  });

  it("ignores what a control enumerates", () => {
    const found = only(
      `export function X() {\n  return (\n    <Select>\n      <SelectItem value="5">5 coins</SelectItem>\n      <option>10 XP</option>\n    </Select>\n  );\n}`,
    );
    assert.deepEqual(found, []);
  });

  it("renders a value through an expression: the fix is invisible to the rule", () => {
    const found = only(
      `export function X() {\n  return <span>{formatMetricValue(metric("dashboard.balance"))}</span>;\n}`,
    );
    assert.deepEqual(found, []);
  });

  it("keeps an expression that renders a whole sentence with no number", () => {
    const found = only(
      `export function X() {\n  return <p>You earned {amount} from quiz plays</p>;\n}`,
    );
    assert.deepEqual(found, []);
  });

  it("flags the delta phrase even when the digit is in the previous node", () => {
    const found = only(`export function X() {\n  return <span>from last month</span>;\n}`);
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, "delta-phrase");
  });

  it("de-duplicates nothing and orders by file then line", () => {
    const found = findMetricLiterals([
      { path: "components/b.tsx", source: `const x = <p>20%</p>;\nconst y = <p>$5</p>;` },
      { path: "components/a.tsx", source: `const x = <p>10k+</p>;` },
    ]);
    assert.deepEqual(
      found.map((literal) => `${literal.file}:${literal.line}`),
      ["components/a.tsx:1", "components/b.tsx:1", "components/b.tsx:2"],
    );
  });
});

describe("the declared gaps are counted, not hidden", () => {
  it("counts relative instants", () => {
    const source = file(`export function X() {\n  return <span>2 hours ago</span>;\n}`);
    assert.equal(relativeLabels(source).length, 1);
    assert.equal(relativeLabels(source)[0].value, "2 hours ago");
  });

  it("counts durations", () => {
    const source = file(`export function X() {\n  return <span>Last 30 days</span>;\n}`);
    assert.equal(durationLabels(source).length, 1);
    assert.equal(durationLabels(source)[0].value, "Last 30 days");
  });
});
