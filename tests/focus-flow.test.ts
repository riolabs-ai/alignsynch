/**
 * A focused flow hides the rail, and the rule is data (#542 phase 2).
 *
 * The card's requirement is a chrome rule with a real failure behind it: a member halfway through
 * editing a relationship's Aspects, or reviewing a publish, should not have eleven other
 * destinations beside the thing they are finishing — and a shell that took the rail away *and* the
 * account header would be a dead end.
 *
 * `lib/shell/focus-flow.ts` is the whole decision, as patterns. This file holds it against the two
 * things it could drift from:
 *
 *   - **the routes on disk** — a pattern that names no route is a dead rule, so each one is
 *     resolved through the same matcher `data:check` uses (`matchRoute`);
 *   - **the list pages next to the flow pages** — `/dashboard/relationships` is a list and
 *     `/dashboard/relationships/<id>` is a flow. `*` matches exactly one segment, and that is the
 *     difference the card asks for: the rail comes back when you leave the editor, not when you
 *     open the list.
 *
 * The chrome itself is a client decision (`components/layout/main-layout.tsx` reaches it through
 * `usePathname`), so the last case reads the mount rather than rendering a browser.
 */
import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import {
  FOCUS_FLOW_BACK_HREF,
  FOCUS_FLOW_PATTERNS,
  isFocusedFlow,
  patternPath,
  segmentsOf,
} from "@/lib/shell/focus-flow";
import { describe, expect, it } from "vitest";

describe("the focused flows", () => {
  it("covers the member's editor, publisher and both template authors", () => {
    for (const pathname of [
      "/dashboard/relationships/abc123",
      "/dashboard/templates/abc123",
      // #794 — the template author's screens moved under the template noun.
      "/templates/relationship/new",
      "/templates/relationship/abc123/create",
    ]) {
      expect(isFocusedFlow(pathname), pathname).toBe(true);
    }
  });

  it("does not cover the list pages beside them", () => {
    for (const pathname of [
      "/dashboard",
      "/dashboard/relationships",
      "/dashboard/templates",
      "/dashboard/help",
      "/dashboard/support",
      "/templates/relationship",
      "/assessment/instances/abc123",
      "/admin/console",
    ]) {
      expect(isFocusedFlow(pathname), pathname).toBe(false);
    }
  });

  it("is a whole-segment match, not a prefix — a deeper child is not a flow", () => {
    // `/dashboard/relationships/<id>/anything` is not one of the card's flows; a prefix rule
    // would quietly adopt every future child of the editor as one.
    expect(isFocusedFlow("/dashboard/relationships/abc123/report")).toBe(false);
    expect(isFocusedFlow("/templates/relationship/abc123")).toBe(false);
  });

  it("ignores a trailing slash, and does not read a query into the path", () => {
    expect(isFocusedFlow("/dashboard/templates/abc123/")).toBe(true);
    expect(segmentsOf("/a/b/")).toEqual(["a", "b"]);
    expect(segmentsOf("/")).toEqual([]);
  });

  it("names a route that exists, for every pattern", () => {
    for (const pattern of FOCUS_FLOW_PATTERNS) {
      const sample = patternPath(pattern).replace("*", "sample");
      expect(matchRoute(routeManifest, sample), `${sample} is not a route`).toBeDefined();
    }
  });

  it("sends the one exit to the workspace, not the marketing site", () => {
    expect(FOCUS_FLOW_BACK_HREF).toBe("/dashboard");
    expect(matchRoute(routeManifest, FOCUS_FLOW_BACK_HREF)).toBeDefined();
  });

  it("leaves the quiz product's authoring screens alone", () => {
    // The quiz build's chrome is that product's; a brand that traded its rail for a focus header
    // without being asked is the reskin this repo's brand rule forbids.
    expect(isFocusedFlow("/create/editor")).toBe(false);
    expect(isFocusedFlow("/create/generator")).toBe(false);
  });
});

describe("the shell's focus chrome", () => {
  it("renders no rail and keeps the header, with one way back", async () => {
    const { readFile } = await import("node:fs/promises");
    const layout = await readFile("components/layout/main-layout.tsx", "utf8");
    const header = await readFile("components/layout/header.tsx", "utf8");
    // The rail is not rendered at all — not collapsed, not hidden behind a class.
    expect(layout).toMatch(/if \(focused\) \{[\s\S]*<Header[\s\S]*<\/div>/);
    expect(layout).toMatch(/focusFlow=\{focus\}/);
    // The bar keeps the wordmark and the account row, and draws the exit first.
    expect(header).toContain("focusFlow.backHref");
    expect(header).toContain("focusFlow.backLabel");
    // The rail the flow hides is the same one the ordinary branch renders.
    expect(layout).toContain("<AppSidebar");
  });
});
