/**
 * The reviewer-facing half of brand parity: what a rendered route *is*, as a diff (#171).
 *
 * A manifest hash answers "did this route change" in 64 characters. It cannot answer "what
 * changed", which is the question a reviewer has when a hash moves — and 300 KB of HTML is not an
 * answer either, because nobody reads a three-hundred-thousand-character diff. So every route, per
 * brand, also commits this summary: the headings it renders, its landmarks, the targets it links
 * to, and the counts that show a page changed shape. That is small enough to read, stable enough
 * that unrelated edits do not shuffle it, and specific enough that "the heading copy changed" is
 * visible without opening the artifact.
 *
 * It is a *summary of the same document the hash is taken over*: `summarize()` reads the
 * normalised HTML (`harness.ts::normalize`), so the two can never disagree about which render they
 * describe. A manifest mismatch pins the route; the summary says which part of it moved; the HTML
 * artifact uploaded by CI is the ground truth when even the summary is silent (a class rename does
 * not appear here — it appears in the artifact and in the hash).
 *
 * ## Why these four groups and not "everything"
 *
 * - **headings** — the page's own words, in order. A copy edit must be visible in the diff.
 * - **landmarks** — resolved by role, not by tag: `header`/`nav`/`main`/`aside`/`footer` map to
 *   their ARIA roles, and an explicit `role="…"` wins, so a `<div role="navigation">` counts as a
 *   navigation landmark. A shell that loses its `main` is a real defect and shows up here as a
 *   number.
 * - **links** — every `<a href>`, unique, sorted, with a count. This is the route's surface: a new
 *   destination, a target that moved, or a link that multiplied is all one line of diff.
 * - **counts** — elements, images, buttons, inputs, and the distinct class-token count with a short
 *   fingerprint of the class set. The fingerprint is deliberately not the class list: tailwind
 *   emits hundreds of tokens per page and a list of them is unreadable, but a *change* to that set
 *   is exactly the "shared class edit" this harness exists to catch, so it gets 12 hex characters
 *   that move when the set moves.
 */
import { createHash } from "node:crypto";

/** The tag-or-text tokenizer `normalize()` splits on: quoted attribute values may hold `>`. */
const TOKEN = /<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g;

/** Heading elements we read text from. */
const HEADING = /^h[1-6]$/;

/** Tag → the landmark role it implies when no explicit `role` is given. */
const LANDMARK_TAGS: Record<string, string> = {
  header: "banner",
  nav: "navigation",
  main: "main",
  aside: "complementary",
  footer: "contentinfo",
};

/** The roles that make an element a landmark, so an explicit `role` is read as one. */
const LANDMARK_ROLES = new Set(["banner", "navigation", "main", "complementary", "contentinfo"]);

type Attributes = Map<string, string>;

/** The attributes of a start tag, lowercased names, quote-stripped values. */
function attributes(token: string): Attributes {
  const map: Attributes = new Map();
  // Drop `<name` and the closing `>` (or `/>`), then read `key="value" | key='value' | key`.
  const inner = token.slice(1, token.endsWith("/>") ? -2 : -1).replace(/^\S+/, "");
  for (const match of inner.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = match[1]?.toLowerCase();
    if (name === undefined || name === "") continue;
    map.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return map;
}

/** One `<a href>` target, normalised as text: entities are left alone, markup never reaches here. */
function hrefOf(element: Attributes): string | undefined {
  const href = element.get("href");
  return href === undefined || href === "" ? undefined : href;
}

/** Sorted `   key   count` lines, the shape every group in the summary uses. */
function tally(counts: Map<string, number>, pad: number): string[] {
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, count]) => `  ${key.padEnd(pad)} ${count}`);
}

/**
 * The structural summary of one rendered route, as committed text.
 *
 * `route` and `brand` are the two things the file must name without the caller having to read the
 * path, so a failure message and a diff line both identify themselves.
 */
export function summarize(html: string, route: string, brand: string): string {
  const flat = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();
  const tokens = flat.match(TOKEN) ?? [];

  const headings: string[] = [];
  const open: { level: number; text: string }[] = [];
  const landmarks = new Map<string, number>();
  const links = new Map<string, number>();
  const classes = new Set<string>();

  let elements = 0;
  let images = 0;
  let buttons = 0;
  let inputs = 0;
  let linkCount = 0;

  for (const token of tokens) {
    if (!token.startsWith("<")) {
      const text = token.trim();
      if (text !== "" && open.length > 0) {
        const heading = open[open.length - 1];
        if (heading !== undefined)
          heading.text = heading.text === "" ? text : `${heading.text} ${text}`;
      }
      continue;
    }

    const closing = token.startsWith("</");
    const name =
      token
        .slice(closing ? 2 : 1)
        .split(/[\s/>]/, 1)[0]
        ?.toLowerCase() ?? "";
    if (name === "") continue;

    if (closing) {
      if (HEADING.test(name) && open.length > 0) {
        const heading = open.pop();
        if (heading !== undefined) headings.push(`h${heading.level}  "${heading.text}"`);
      }
      continue;
    }

    elements += 1;
    const attrs = attributes(token);

    // Landmark: an explicit role wins over the tag's implied one, and counts once per element.
    const explicit = attrs.get("role");
    const role =
      explicit !== undefined && LANDMARK_ROLES.has(explicit) ? explicit : LANDMARK_TAGS[name];
    if (role !== undefined) landmarks.set(role, (landmarks.get(role) ?? 0) + 1);

    if (name === "img") images += 1;
    if (name === "button") buttons += 1;
    if (name === "input" || name === "select" || name === "textarea") inputs += 1;

    if (name === "a") {
      const href = hrefOf(attrs);
      if (href !== undefined) {
        linkCount += 1;
        links.set(href, (links.get(href) ?? 0) + 1);
      }
    }

    const classAttribute = attrs.get("class");
    if (classAttribute !== undefined) {
      for (const token of classAttribute.split(/\s+/)) if (token !== "") classes.add(token);
    }

    if (HEADING.test(name)) {
      const level = Number(name.slice(1));
      // A self-closing heading holds no text; every real one is closed below.
      if (token.endsWith("/>")) headings.push(`h${level}  ""`);
      else open.push({ level, text: "" });
    }
  }

  const classList = [...classes].sort();
  const classSha = createHash("sha256").update(classList.join(" ")).digest("hex").slice(0, 12);

  const lines: string[] = [
    `route  ${route}`,
    `brand  ${brand}`,
    "",
    `headings (${headings.length})`,
    ...(headings.length === 0 ? ["  (none)"] : headings.map((heading) => `  ${heading}`)),
    "",
    `landmarks (${[...landmarks.values()].reduce((sum, count) => sum + count, 0)})`,
    ...(landmarks.size === 0 ? ["  (none)"] : tally(landmarks, 14)),
    "",
    `links (${links.size} unique, ${linkCount} total)`,
    ...(links.size === 0 ? ["  (none)"] : tally(links, 52)),
    "",
    "counts",
    `  elements  ${elements}`,
    `  images    ${images}`,
    `  buttons   ${buttons}`,
    `  inputs    ${inputs}`,
    `  classes   ${classes.size} (sha ${classSha})`,
  ];

  return `${lines.join("\n")}\n`;
}

/**
 * The committed artifact for a route whose surface is **off**: a declared 404, not a render (#175).
 *
 * `document` is what the manifest hashes and what the failure artifact holds; `summary` is what a
 * reviewer reads. Both name the flag, so the pair is a statement of *why* there is no page — and
 * the day the flag is turned on, the hash moves and the summary's `outcome` line changes from a
 * 404 to headings, which is the diff that asks for a decision rather than hiding one.
 *
 * `off` says which of the two ways a surface can be missing this is, because they are different
 * facts and the artifact has to state the right one (#300):
 *
 *   `"flag"`   the flag is off **on this build**, for everybody — `/leaderboard` today (#175).
 *   `"brand"`  the flag is off **because this brand does not ship the product** — the boundary
 *              `/quiz/[id]` crosses on the alignment build (#300).
 *
 * The document is identical in both cases (route, brand, outcome, flag — the hash is a function of
 * what the surface is, not of the sentence explaining it), and the summary differs only in that
 * sentence, so a reviewer reading the pair gets the reason without having to hold two formats.
 */
export function absentRender(
  route: string,
  brand: string,
  flag: string,
  off: "flag" | "brand" = "flag",
): { document: string; summary: string } {
  const document = `route  ${route}\nbrand  ${brand}\noutcome  404\nflag  ${flag}\n`;

  const reason =
    off === "brand"
      ? `outcome  404 — ${flag} is off on the ${brand} build (data/flags.ts)`
      : `outcome  404 — ${flag} is off (data/flags.ts)`;

  const advice =
    off === "brand"
      ? [
          "This route is in the parity list and renders nothing on this brand: the quiz product",
          "ships on the quiz template only, so the page calls notFound() before reading anything",
          "(`lib/brand-boundary.ts`). It is not a mock gate — the surface exists, one brand just",
          "does not sell it. If this brand should ship it, change `templates` in data/flags.ts",
          'and run `pnpm parity:update --reason "…"`.',
        ]
      : [
          "This route is in the parity list and currently renders nothing: the surface is flagged",
          "off, so the page calls notFound() before reading anything. Turning the flag on makes",
          'this hash move to a rendered page — run `pnpm parity:update --reason "…"` and drop',
          "`disabledByFlag` from tests/parity/routes.ts.",
        ];

  const summary = [`route  ${route}`, `brand  ${brand}`, "", reason, "", ...advice].join("\n");

  return { document, summary: `${summary}\n` };
}
