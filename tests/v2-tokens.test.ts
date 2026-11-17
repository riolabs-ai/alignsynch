/**
 * The v2.0 token layer is a **contract with the bundle**, and this file is what keeps it one (#1120).
 *
 * The visual authority is
 * `docs/specs/v2-bundles/09-spec-design-system-tokens-v2/` (epic #1119), and its own validation
 * checklist states the two rules this suite enforces:
 *
 *   - "Every token in `css/tokens.css` exists in `app/globals.css` with the same value."
 *   - "`tailwind.config.ts` exposes every class `tw-config.js` defines."
 *
 * Both are read out of the bundle's files rather than restated as a second list, so a value that
 * drifts in either direction fails here by name instead of surfacing as a wrong swatch on a
 * surface card six PRs later. Comparison is numeric per channel (the bundle writes `50.0%`, a CSS
 * formatter may write `50%`, and both are the same colour) rather than a string equality that
 * would fail on formatting while the palette stayed correct.
 *
 * What this suite deliberately does **not** assert: that the app's `:root` equals the bundle's.
 * `tokens.css` is the AlignSynch lane's mirror of the sheet, and the shared `:root` is the
 * template's — `--primary`, `--background` and the sRGB chart set differ on purpose, and the brand
 * record paints `--paper`/`--mist`/`--sand`/`--line`/`--pale`/`--mark`/`--deep` on `<html>` from
 * `data/brands/alignsynch.ts`. The v2 roles below are the *product* ones both builds share.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

const BUNDLE = "docs/specs/v2-bundles/09-spec-design-system-tokens-v2";
const GLOBALS = read("app/globals.css");
const TOKENS = read(`${BUNDLE}/css/tokens.css`);
const TAILWIND = read("tailwind.config.ts");

/** Party roles — five per party, clay initiator / slate-teal counterparty. */
const PARTY = [
  "--initiator",
  "--initiator-ink",
  "--initiator-solid",
  "--initiator-tint",
  "--initiator-line",
  "--counterparty",
  "--counterparty-ink",
  "--counterparty-solid",
  "--counterparty-tint",
  "--counterparty-line",
];

/** The three Gap statuses, in the ink weight and the vivid `-mark` weight. */
const STATUS = [
  "--synch",
  "--synch-tint",
  "--synch-mark",
  "--small-gap",
  "--small-gap-tint",
  "--small-gap-mark",
  "--gap",
  "--gap-tint",
  "--gap-mark",
];

/** Purpose surfaces: progress (`status`) and payment/membership (`billing`). */
const SURFACES = [
  "--status",
  "--status-line",
  "--status-chip",
  "--billing",
  "--billing-line",
  "--billing-chip",
  "--billing-ink",
];

/** The locked 1 (warm apricot) → 5 (sage) answer scale. */
const SCALE = ["--scale-1", "--scale-2", "--scale-3", "--scale-4", "--scale-5"];

const V2_TOKENS = [...PARTY, ...STATUS, ...SURFACES, ...SCALE, "--deep-calm"];

/**
 * The one token whose *name* moves in the port, so the test states it rather than pretending the
 * bundle already carried it: the prototype's `--deep` is `#276a80` (its own calm re-tone), and it
 * lands as `--deep-calm` because the brand record keeps `deep` `#156898` (epic D-F, and #1120's
 * own out-of-scope line). Every other v2 token keeps its name.
 */
const BUNDLE_NAME: Readonly<Record<string, string>> = { "--deep-calm": "--deep" };

/**
 * Every colour `tw-config.js` defines, as `[key as written in tailwind.config.ts, custom property]`.
 * Quoted keys are quoted here too — `deep-calm`, `small-gap` and the numeric scale steps need it.
 */
const TAILWIND_COLORS: readonly (readonly [string, string])[] = [
  ['"deep-calm"', "--deep-calm"],
  ["DEFAULT", "--initiator"],
  ["ink", "--initiator-ink"],
  ["solid", "--initiator-solid"],
  ["tint", "--initiator-tint"],
  ["line", "--initiator-line"],
  ["DEFAULT", "--counterparty"],
  ["ink", "--counterparty-ink"],
  ["solid", "--counterparty-solid"],
  ["tint", "--counterparty-tint"],
  ["line", "--counterparty-line"],
  ["DEFAULT", "--status"],
  ["line", "--status-line"],
  ["chip", "--status-chip"],
  ["DEFAULT", "--billing"],
  ["line", "--billing-line"],
  ["chip", "--billing-chip"],
  ["ink", "--billing-ink"],
  ["DEFAULT", "--synch"],
  ["tint", "--synch-tint"],
  ["mark", "--synch-mark"],
  ["DEFAULT", "--small-gap"],
  ["tint", "--small-gap-tint"],
  ["mark", "--small-gap-mark"],
  ["DEFAULT", "--gap"],
  ["tint", "--gap-tint"],
  ["mark", "--gap-mark"],
  ['"1"', "--scale-1"],
  ['"2"', "--scale-2"],
  ['"3"', "--scale-3"],
  ['"4"', "--scale-4"],
  ['"5"', "--scale-5"],
];

/** The `:root` block of a stylesheet, matched by the indentation that names it. */
function rootBlock(css: string, opener: RegExp): string {
  const start = opener.exec(css);
  if (start === null) throw new Error(`no :root block matched ${String(opener)}`);
  const from = start.index + start[0].length;
  let depth = 1;
  for (let at = from; at < css.length; at++) {
    const char = css[at];
    if (char === "{") depth++;
    else if (char === "}") depth--;
    if (depth === 0) return css.slice(from, at);
  }
  throw new Error("unbalanced :root block");
}

/** Every `--token: value;` declaration in a block, last one winning. */
function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    found.set(match[1], match[2].trim());
  }
  return found;
}

/** `13.6 50.0% 56.9%` -> `[13.6, 50, 56.9]`; anything else is a test failure, not a skip. */
function hslTriple(value: string): [number, number, number] {
  const match = /^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(value.trim());
  if (match === null) throw new Error(`not an HSL triplet: ${JSON.stringify(value)}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** A channel rounded to one decimal, so `50.0%` and `50%` compare equal. */
const round = (channel: number) => Math.round(channel * 10) / 10;

const app = declarations(rootBlock(GLOBALS, /^ {2}:root\s*\{/m));
const bundle = declarations(rootBlock(TOKENS, /^:root\s*\{/m));

describe("v2.0 design tokens (#1120)", () => {
  it("ports every product token with the bundle's own value", () => {
    for (const token of V2_TOKENS) {
      expect(app.get(token), `${token} is missing from app/globals.css :root`).toBeDefined();
      const source = BUNDLE_NAME[token] ?? token;
      const fromBundle = bundle.get(source);
      expect(
        fromBundle,
        `${source} is not in the bundle's tokens.css — a token this sheet invented is not a port`,
      ).toBeDefined();
      const ported = hslTriple(app.get(token) as string);
      const authoritative = hslTriple(fromBundle as string);
      expect(ported.map(round), `${token} drifted from ${BUNDLE}/css/tokens.css`).toEqual(
        authoritative.map(round),
      );
    }
  });

  it("keeps the locked answer scale in apricot → sage order", () => {
    // The five steps must read as one ramp: hue climbs 21° → 133°, so a re-ordered or re-toned
    // step is a wrong answer position, not a taste question. §17 of the design system locks it.
    const hues = SCALE.map((token) => hslTriple(app.get(token) as string)[0]);
    expect(hues).toEqual([...hues].sort((left, right) => left - right));
    expect(hues[0]).toBeLessThan(30);
    expect(hues[hues.length - 1]).toBeGreaterThan(120);
  });

  it("exposes every colour class the bundle's Tailwind theme defines", () => {
    for (const [key, token] of TAILWIND_COLORS) {
      const quoted = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const entry = new RegExp(`${quoted}\\s*:\\s*"hsl\\(var\\(${token}\\)\\)"`);
      expect(
        entry.test(TAILWIND),
        `tailwind.config.ts does not resolve ${token} (expected \`${key}: "hsl(var(${token}))"\`)`,
      ).toBe(true);
    }
  });

  it("names the bundle's colour groups, so the utility prefix exists too", () => {
    // A leaf that resolves is only half the class: `DEFAULT: "hsl(var(--small-gap))"` paints
    // nothing unless the group it sits in is called `small-gap`, because the utility is
    // `bg-small-gap` (likewise `bg-initiator-tint`, `bg-scale-3`). So the group keys are asserted
    // by name as well as the values.
    for (const group of [
      "initiator",
      "counterparty",
      "status",
      "billing",
      "synch",
      '"small-gap"',
      "gap",
      "scale",
    ]) {
      expect(TAILWIND, `the ${group} colour group is missing`).toMatch(
        new RegExp(`${group}:\\s*\\{`),
      );
    }
  });

  it("exposes the bundle's layout measures", () => {
    expect(TAILWIND).toMatch(/maxWidth:\s*\{\s*content:\s*"90rem"\s*\}/);
    for (const grid of ["shell", "detail", "scale", "answer", "answer-sm"]) {
      expect(TAILWIND, `grid-cols-${grid} is not exposed`).toContain(
        grid.includes("-") ? `"${grid}":` : `${grid}:`,
      );
    }
  });

  it("leaves the shared status and density tokens unchanged", () => {
    // Card step 2: the status hues (blue / amber / green / red / slate) mean the same thing on
    // both brands, and every v2 token this card adds is *additive*. These four are the values a
    // "no red anywhere" or "tighter density" pass would move — and both of those repaint QuizHub,
    // which this card may not touch. When a later card does move one, it changes this line too,
    // deliberately, and says so.
    expect(app.get("--destructive")).toBe("0 76% 46%");
    expect(app.get("--muted-foreground")).toBe("215 21% 44%");
    expect(app.get("--border")).toBe("30 16% 84%");
    expect(app.get("--radius")).toBe("0.3125rem");
  });

  it("keeps the existing Gap scale beside the new --gap ink", () => {
    // `--gap` (the burnt-amber status ink) lands one declaration away from `--gap-0..4` (the Gap
    // scale, #539). They are different facts with similar names, so a rename that "tidies" one
    // into the other would silently repaint the histogram.
    for (const step of [0, 1, 2, 3, 4]) {
      expect(app.get(`--gap-${step}`), `the Gap scale lost --gap-${step}`).toBeDefined();
    }
    expect(hslTriple(app.get("--gap") as string)).not.toEqual(
      hslTriple(app.get("--gap-0") as string),
    );
  });
});
