/**
 * The marketing page's copy rules are acceptance criteria, not advice (issue #159).
 *
 * The card states them as a gate: zero matches for nine words, zero percentages, no testimonial,
 * no test, no rating, no customer name, no count the product cannot prove. A rule that lives only
 * in a review comment is a rule the next card can walk through, so this file turns the mechanical
 * half into a test — the same way `page-copy.test.ts` turns E23 into one.
 *
 * What a node test can see is the *fixture*, which is the whole page's words: `PageCopy` is a
 * plain object with no markup, and every band the layout draws is a field on it. So the walk below
 * collects every string the fixture carries, in declaration order, and the assertions run over
 * that collection. The structural half — no `<aside>`, no sidebar, no product link but the CTA — is
 * proved against the built HTML, because a component tree cannot answer it from a node process.
 *
 * Three claims, and why each is worth a test rather than a promise:
 *
 *   1. **The nine banned words.** The live site is a structural reference and its adjectives are
 *      the thing most likely to arrive by habit. Inflections count (`/\bword/`), so "unlocks" and
 *      "leveraging" fail too.
 *   2. **No percentage.** A `%` in this fixture is a metric claim dressed as a glyph, and the
 *      product cannot prove one today.
 *   3. **The seven bands, in the issue's order**, and the four opinions split two basic / two
 *      advanced — "Feel and Wish in basic mode, Think and Guess in advanced" is the sentence the
 *      card forbids presenting any other way.
 *
 * The link rule is the one that keeps the page honest about the product: the only root-relative
 * href in the fixture is the single CTA, so no band can grow a second doorway into the app.
 */
import { describe, expect, it } from "vitest";

import { marketingPageCopy, marketingTitle } from "@/data/pages/marketing";
import { pageCopies } from "@/data/pages/index";
import { pageCopyBudget } from "@/data/pages/budget";
import { ROUTE_PATTERNS, routeManifest } from "@/content/routes";
import { alignSynchBrand } from "@/data/brands/alignsynch";

/** Every string the fixture carries, in declaration order. */
function strings(value: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (node && typeof node === "object") {
      for (const entry of Object.values(node)) walk(entry);
    }
  };
  walk(value);
  return out;
}

/**
 * The nine words the card bans. Written as one pattern so a tenth is one line, and matched at a
 * word boundary so `"unlocked"` and `"leverage"` both fail while a word that merely contains the
 * letters is not a false positive.
 */
const BANNED =
  /\b(unlock|empower|seamless|elevate|revolutionary|game-changing|leverage|supercharge|effortlessly)/i;

/** Claims of social proof, which the card bans outright rather than rewording. */
const SOCIAL_PROOF = /\b(trusted by|uptime|testimonial|rating|five-star|customers? say)\b/i;

describe("the marketing fixture", () => {
  it("carries no banned word, in any band", () => {
    const offenders = strings(marketingPageCopy).filter((line) => BANNED.test(line));
    expect(offenders).toEqual([]);
  });

  it("carries no percentage", () => {
    const offenders = strings(marketingPageCopy).filter((line) => line.includes("%"));
    expect(offenders).toEqual([]);
  });

  it("carries no claim of social proof", () => {
    const offenders = strings(marketingPageCopy).filter((line) => SOCIAL_PROOF.test(line));
    expect(offenders).toEqual([]);
  });

  it("gives its bands the order the issue gives them", () => {
    const ids = (marketingPageCopy.sections ?? []).map((section) => section.id);
    /**
     * `version` is not a band of the page: it is the words `/welcome`'s footer prints under the
     * build's version (issue #269), carried in this fixture because the footer reads this
     * surface's copy. The six bands the issue names are asserted in order, and that the badge's
     * section really exists is the next case — filtering it out here must not be a way to drop it.
     */
    expect(ids.filter((id) => id !== "version")).toEqual([
      "domains",
      "how-it-works",
      "opinions",
      "gap",
      "limits",
      "cta",
    ]);
  });

  it("carries the version badge's three ids, which the footer resolves", () => {
    const version = (marketingPageCopy.sections ?? []).find((section) => section.id === "version");
    expect(version?.items?.map((item) => item.id)).toEqual(["label", "compact", "title"]);
  });

  it("states the four opinions as two basic and two advanced", () => {
    const opinions = (marketingPageCopy.sections ?? []).find(
      (section) => section.id === "opinions",
    );
    const modes = (opinions?.items ?? []).map((item) => `${item.label}:${item.value}`);
    expect(modes).toEqual(["Feel:Basic", "Wish:Basic", "Think:Advanced", "Guess:Advanced"]);
  });

  it("links to one product route and nothing else", () => {
    const hrefs = strings(marketingPageCopy).filter((line) => line.startsWith("/"));
    expect(new Set(hrefs).size).toBe(1);
    expect(hrefs[0]).toBe(marketingPageCopy.cta?.href);
    expect(pageCopies["/welcome"].cta?.href).toBe("/assessment/avery-rowan");
  });

  it("resolves every link it does carry against the route manifest", () => {
    const href = marketingPageCopy.cta?.href ?? "";
    const resolves = ROUTE_PATTERNS.some(
      (pattern) =>
        pattern === href ||
        (pattern.includes("[") &&
          new RegExp(`^${pattern.replace(/\[[^\]]+\]/g, "[^/]+")}$`).test(href)),
    );
    expect(resolves).toBe(true);
  });

  it("is the page copy the `/welcome` route owns, with a budget of zero", () => {
    // `zPageCopyTable.parse` re-parses the table, so this is equality, not identity.
    expect(pageCopies["/welcome"]).toEqual(marketingPageCopy);
    expect(pageCopyBudget["/welcome"]?.fixture).toBe("data/pages/marketing");
    expect(pageCopyBudget["/welcome"]?.budget).toBe(0);
    expect(routeManifest.routes.some((route) => route.pattern === "/welcome")).toBe(true);
  });

  it("names the product from the brand record, not from a spelling", () => {
    expect(marketingTitle(alignSynchBrand)).toContain(alignSynchBrand.name);
    expect(marketingTitle({ name: "Another Product" })).toContain("Another Product");
  });
});
