/**
 * metric-refs — the pure half of E22: the numbers a component types into JSX.
 *
 * A rendered quantity is the one display literal nobody could see was invented. `$124.50`,
 * `+4 from last month`, `500 Coins`, `Save 20%` all *resolve* — there is no route to 404, no
 * asset to miss, no schema key to reject — so every other check stayed green while 40 nodes
 * of the dashboard, the reward table and the affiliate page asserted numbers nothing in
 * `data/` produced (issue #49, `docs/P2-INVENTORY.md` WU-4). E10 proved a link works; this
 * proves a number is owned.
 *
 * Deliberately limited to what is *rendered*:
 *
 *   - `JsxText`          — the copy a user reads (`<span>+4 from last month</span>`)
 *   - `JsxExpression` holding a string/no-substitution template — `{"Save 20%"}`
 *   - a display attribute's string value — `label="Save 20%"`
 *
 * A number that reaches the DOM through an expression (`{quiz.stats.plays}`,
 * `{formatCurrency(cents)}`) is the model's, so it is invisible here by construction: that is
 * the shape the fix takes, and the rule cannot be satisfied by deleting the fixture.
 *
 * ## The vocabulary (what a *value* is, and what is only chrome)
 *
 * A metric is a claim about the product's numbers, so the rule fires on the units a claim
 * carries and on nothing else:
 *
 *   percent      `78.3%`, `20%`              a proportion
 *   money        `$124.50`, `$5,000`          a currency amount
 *   delta        `+4`, `-3`                   a signed change
 *   magnitude    `10k+`, `$1M+`, `2.5k`       a count compressed to a suffix
 *   quantity     `500 Coins`, `1,248 participants`, `3-10 players`, `2.5k`, `#42 points`
 *   delta-phrase `from last month`            the tail of a delta, even with no digit in this node
 *
 * Three classes are deliberately **out**, each with a different owner (a W-item, not an
 * E-item). They are stripped before matching so the exclusion is one statement, not a
 * scattering of `if`s:
 *
 *   - **Relative instants** — `2 hours ago`, `in 3 days`. The fixture clock owns those
 *     (`DEMO_NOW_ISO` + `formatRelative`); `relativeLabels()` counts them so the gap stays
 *     visible instead of being quietly folded into the metric rule.
 *   - **Durations** — `5 seconds`, `Last 30 days`, `4m 12s`, `28 days left`. A duration is a
 *     form option or a window label, and the units spell that: `seconds|minutes|hours|days|
 *     weeks|months|years`. `docs/DATA-MODEL.md` owns durations; E22 does not.
 *   - **Form enumerations** — a node inside `<SelectItem>`/`<option>` lists what a control
 *     *accepts* (`10 seconds`, `20 questions`), it does not assert a product fact. The option
 *     set belongs to the control, and a record stored in the component is E21's failure.
 *
 * A bare number with no unit (`42`, `620`, `#42`) is also out: at the AST level it is
 * indistinguishable from chrome (pagination, step counts, rank prefixes). Those live in the
 * MOCK tier (E21) or the copy budget (E23).
 *
 * Nothing here imports `fs`, `react` or `next`: `data-check.ts` supplies the sources, and the
 * negative cases in `scripts/__tests__/metric-refs.test.ts` supply inline ones.
 */
import {
  ScriptKind,
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxSelfClosingElement,
  isJsxText,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  type Node,
} from "typescript";

import type { SourceFile } from "./ui-refs";

export type MetricKind = "percent" | "money" | "delta" | "magnitude" | "quantity" | "delta-phrase";

export interface MetricLiteral {
  /** Repo-relative path, reported verbatim in diagnostics. */
  file: string;
  /** 1-based line of the node, so the diagnostic is clickable. */
  line: number;
  /** The rendered text, whitespace-collapsed. */
  value: string;
  /** Which clause of the rule fired. */
  kind: MetricKind;
}

/**
 * The unit nouns a rendered count carries. An explicit list, not `\w+`: `500 Coins` is a
 * claim, `1v1` and `2 dashes` are not.
 */
const VALUE_UNITS = "XP|coins?|players?|participants?|points?|affiliates?";

const PATTERNS: ReadonlyArray<{ kind: MetricKind; pattern: RegExp }> = [
  /** `78.3%`, `20%` — a proportion. */
  { kind: "percent", pattern: /\d[\d,]*\.?\d*\s?%/ },
  /** `$124.50`, `$5,000`, `$1M+` — money. */
  { kind: "money", pattern: /\$\s?\d/ },
  /** `+4`, `-3`, `+2.1%` — a signed change (the sign opens a token, it does not follow a digit). */
  { kind: "delta", pattern: /(?:^|[\s(])[+-]\d/ },
  /** `10k+`, `2.5k`, `1M` — a compressed count. */
  { kind: "magnitude", pattern: /\b\d[\d,.]*\s?[kKmM]\b/ },
  /** `500 Coins`, `1,248 participants`, `3-10 players`. */
  {
    kind: "quantity",
    pattern: new RegExp(`\\b\\d[\\d,.]*\\s?(?:${VALUE_UNITS})\\b`, "i"),
  },
  /** The tail of a delta: `from last month` renders a change with no digit in this node. */
  { kind: "delta-phrase", pattern: /\bfrom (?:last|this) (?:day|week|month|year)\b/i },
];

/** `2 hours ago`, `in 3 days` — a relative instant, owned by the fixture clock. */
const RELATIVE_INSTANT =
  /\b\d+\s*(?:second|minute|hour|day|week|month|year)s?\s+ago\b|\bin\s+\d+\s*(?:second|minute|hour|day|week|month|year)s?\b/gi;

/** `5 seconds`, `Last 30 days`, `4m 12s`, `3 Days` — a duration, not a value claim. */
const DURATION =
  /\b\d[\d,.]*\s?(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\b|\b\d+\s?[mh]\s?\d+\s?s\b/gi;

/** `+1 (555) 123-4567` — a phone number opens with a `+`, which is not a delta. */
const PHONE_NUMBER = /\+\d[\s-]?\(\d{3}\)[\s-]?\d{3}[\s-]?\d{4}/g;

/** `+1` in a stepper ("Step +1") is a control affordance, not a change. */
const STEPPER = /^(?:Step\s*)?[+-]\d$/i;

/** Display attributes whose string value a user reads. `className`/`href`/`id` are not copy. */
const DISPLAY_ATTRIBUTES = new Set(["label", "title", "description", "subtitle", "heading", "alt"]);

/** Elements whose children enumerate what a control accepts. See the header. */
const OPTION_ELEMENTS = new Set(["SelectItem", "option"]);

/** Collapse JSX whitespace so a diagnostic is one line and a test can assert it. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Everything the rule ignores inside one rendered string. */
function stripExcluded(text: string): string {
  return text.replace(RELATIVE_INSTANT, " ").replace(DURATION, " ").replace(PHONE_NUMBER, " ");
}

/** The metric kind a rendered string carries, or `undefined` when it is only copy. */
export function metricKindOf(text: string): MetricKind | undefined {
  const candidate = stripExcluded(text);
  if (STEPPER.test(candidate.trim())) return undefined;
  for (const { kind, pattern } of PATTERNS) {
    if (pattern.test(candidate)) return kind;
  }
  return undefined;
}

/** The tag name of a JSX opening element, or `""`. */
function tagNameOf(node: Node, source: ReturnType<typeof createSourceFile>): string {
  if (isJsxElement(node)) return node.openingElement.tagName.getText(source);
  if (isJsxSelfClosingElement(node)) return node.tagName.getText(source);
  return "";
}

/**
 * Every rendered value in the given sources. A node is reported once, with the first clause
 * of the rule that matched it. `undefined` inside an element that enumerates options is
 * skipped (see the header).
 */
export function findMetricLiterals(files: SourceFile[]): MetricLiteral[] {
  const found: MetricLiteral[] = [];

  const report = (
    file: SourceFile,
    source: ReturnType<typeof createSourceFile>,
    node: Node,
    raw: string,
  ) => {
    const value = collapseWhitespace(raw);
    if (value.length === 0) return;
    const kind = metricKindOf(value);
    if (!kind) return;
    found.push({
      file: file.path,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      value,
      kind,
    });
  };

  for (const file of files) {
    const source = createSourceFile(
      file.path,
      file.source,
      ScriptTarget.ES2022,
      true,
      ScriptKind.TSX,
    );

    const walk = (node: Node) => {
      const optionChild =
        (isJsxElement(node) && OPTION_ELEMENTS.has(tagNameOf(node, source))) ||
        (isJsxSelfClosingElement(node) && OPTION_ELEMENTS.has(tagNameOf(node, source)));

      /** An option enumerates what a control accepts: skip its whole subtree. */
      if (optionChild) return;

      if (isJsxText(node)) {
        report(file, source, node, node.text);
      } else if (isJsxExpression(node)) {
        const expression = node.expression;
        if (
          expression &&
          (isStringLiteral(expression) || isNoSubstitutionTemplateLiteral(expression))
        ) {
          report(file, source, expression, expression.text);
        }
      } else if (isJsxAttribute(node) && DISPLAY_ATTRIBUTES.has(node.name.getText(source))) {
        const initializer = node.initializer;
        if (initializer && isStringLiteral(initializer)) {
          report(file, source, initializer, initializer.text);
        }
      }

      forEachChild(node, walk);
    };
    walk(source);
  }

  return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/**
 * Relative-instant labels (`2 hours ago`) in the same sources. Not an E22 failure: the clock
 * is the fixture's (`DEMO_NOW_ISO` + `formatRelative`), so they are counted and reported
 * separately rather than folded into the metric rule and quietly tolerated.
 */
export function relativeLabels(files: SourceFile[]): MetricLiteral[] {
  return collect(files, RELATIVE_INSTANT);
}

/** Duration labels (`Last 30 days`, `4m 12s`) in the same sources — the other declared gap. */
export function durationLabels(files: SourceFile[]): MetricLiteral[] {
  return collect(files, DURATION);
}

function collect(files: SourceFile[], pattern: RegExp): MetricLiteral[] {
  const found: MetricLiteral[] = [];
  for (const file of files) {
    const source = createSourceFile(
      file.path,
      file.source,
      ScriptTarget.ES2022,
      true,
      ScriptKind.TSX,
    );
    const walk = (node: Node) => {
      const raw = isJsxText(node)
        ? node.text
        : isJsxExpression(node) &&
            node.expression &&
            (isStringLiteral(node.expression) || isNoSubstitutionTemplateLiteral(node.expression))
          ? node.expression.text
          : undefined;
      if (raw !== undefined) {
        const value = collapseWhitespace(raw);
        pattern.lastIndex = 0;
        if (pattern.test(value)) {
          found.push({
            file: file.path,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            value,
            kind: "delta-phrase",
          });
        }
      }
      forEachChild(node, walk);
    };
    walk(source);
  }
  return found;
}
