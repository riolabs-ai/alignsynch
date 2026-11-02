/**
 * The review control is **one** control, and it lands on the row it names.
 *
 * The owner's note on `/v1/relationships/rel-connected-blind/accept` was that the `unreviewed`
 * pill rendered twice — once in the sticky persona bar and once at the foot of the page — and that
 * neither did anything: both opened the top of `/v1/review`, not that screen's todo. The claims
 * this file pins are the ones the card makes acceptance criteria:
 *
 *   one control   the shell's footer mounts it; the sticky persona bar does not;
 *   row address   every screen's control links to that screen's row (`#screen-…`), and the id
 *                 the list renders is the id the link names — the round trip, not a pattern;
 *   unique        no two screens share an id, so a link can never land on the wrong row;
 *   nothing else  an unknown id and an absent hash resolve to no row, so the list has nothing to
 *                 scroll to rather than a wrong element to jump at.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  REVIEW_SCREENS,
  reviewScreenFromHash,
  reviewScreenFromId,
  reviewScreenHref,
  reviewScreenId,
} from "@/lib/v1/review";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("a screen's review row has an address", () => {
  it("names every row by the route that keys its status", () => {
    const ids = REVIEW_SCREENS.map((screen) => reviewScreenId(screen.route));
    expect(new Set(ids).size).toBe(ids.length);
    // The route *is* the key the store persists the status under, so it is the key of the row.
    for (const screen of REVIEW_SCREENS) {
      expect(reviewScreenFromId(reviewScreenId(screen.route))?.route).toBe(screen.route);
    }
  });

  it("links the accept screen to the accept row, not the list", () => {
    expect(reviewScreenHref("/v1/relationships/[id]/accept")).toBe(
      "/v1/review#screen-v1-relationships-id-accept",
    );
    expect(reviewScreenFromHash("#screen-v1-relationships-id-accept")?.route).toBe(
      "/v1/relationships/[id]/accept",
    );
    // The dynamic segments are part of the id: the accept row and the relationship row differ.
    expect(reviewScreenId("/v1/relationships/[id]")).not.toBe(
      reviewScreenId("/v1/relationships/[id]/accept"),
    );
  });

  it("round-trips every screen through its own href", () => {
    for (const screen of REVIEW_SCREENS) {
      const hash = reviewScreenHref(screen.route).split("#")[1];
      expect(reviewScreenFromHash(hash)?.route).toBe(screen.route);
    }
    // A bare `#` and no hash at all are not rows.
    expect(reviewScreenFromHash("#")).toBeUndefined();
    expect(reviewScreenFromHash("")).toBeUndefined();
    expect(reviewScreenFromHash(undefined)).toBeUndefined();
    expect(reviewScreenFromId("screen-not-a-route")).toBeUndefined();
  });
});

describe("one review control, in the footer", () => {
  it("mounts it in the shell's footer and nowhere in the sticky persona bar", () => {
    const shell = source("components/v1/v1-shell.tsx");
    const bar = source("components/v1/persona-bar.tsx");

    expect(shell).toContain("ReviewFooter");
    expect(shell).toContain("<ReviewFooter />");
    // The persona bar is the sticky header — the duplicate the card deletes. It neither imports
    // the control nor renders it; its prose may still name where the control lives.
    expect(bar).not.toContain('from "@/components/v1/review-chip"');
    expect(bar).not.toContain("<ReviewChip");
    expect(bar).not.toContain("<ReviewFooter");
  });

  it("renders the control inside the footer element, on every breakpoint", () => {
    const chip = source("components/v1/review-chip.tsx");
    const footer = chip.slice(chip.indexOf("export function ReviewFooter"));

    expect(footer).toContain("<footer");
    expect(footer).toContain("<ReviewChip />");
    // The page used to hide the only surviving control below `sm`, which left a phone reviewer
    // with no status at all; the footer draws it at every width.
    expect(footer).not.toContain("hidden sm:inline-flex");
  });
});
