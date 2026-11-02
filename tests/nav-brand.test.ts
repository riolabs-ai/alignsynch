/**
 * The shell's navigation is brand- and role-aware (issue #156).
 *
 * The failure this pins: `BRAND=alignsynch` rendered the alignment front page, and its first
 * click — Leaderboard, Tournaments, Battle, Categories, Explore — landed in the quiz product.
 * The fix is one navigation definition filtered by brand and capability, and the claims below
 * are the four that make it a fix rather than a rewrite:
 *
 *   1. the quiz brand's menu is the menu it shipped: the same fifteen destinations, in order;
 *   2. the alignment brand's menu is alignment destinations only, and every `/#…` it links to
 *      is an `id` the alignment front page actually emits;
 *   3. a viewer carrying the quiz capability gets the quiz menu back — which is what makes the
 *      split a visibility rule and not a deletion of the product;
 *   4. the footer's columns follow the same rule as the sidebar's rows.
 *
 * "Renders" means `renderToStaticMarkup`: `AppNav` and `Footer` are pure functions of their
 * props (`next/link` is mocked to an anchor, because this file is about destinations, not
 * client-side routing), so the markup is the screen and a node environment can read the
 * `href`s out of it. The stubbed capability is not asserted as a *fixed* value anywhere: the
 * admin branch is proven by constructing the viewer a role model will one day hand back.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AlignmentHomeView } from "@/components/home/alignment-home";
import { Footer } from "@/components/layout/footer";
import { AppNav } from "@/components/layout/nav-menus";
import { isValidRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { querySearchIndex } from "@/content/search";
import type { BrandId } from "@/data/brand";
import { assessmentInstances, assessments } from "@/data/assessments";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { ALIGN_SYNCH_FEATURED_SLUG, alignSynchHomeCopy } from "@/data/pages/home-alignsynch";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndex, searchIndexFor } from "@/data/searchdata";
import { alignmentHome } from "@/lib/alignment-home";
import { ALIGNMENT_ROUTES, type NavViewer, PLATFORM_VIEWER, viewerWith } from "@/lib/nav";
import { itemLabel } from "@/lib/page-copy";
import { searchSectionFor } from "@/lib/shell-copy";

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/** The sidebar's markup for one brand and one viewer. */
function navHtml(brandId: BrandId, viewer: NavViewer = PLATFORM_VIEWER): string {
  return renderToStaticMarkup(
    createElement(AppNav, {
      brandId,
      viewer,
      copy: shellPageCopy,
      collapsed: false,
      pathname: "/",
      onNavigate: () => undefined,
    }),
  );
}

/** The sidebar's rows for one brand and one viewer. */
function navHrefs(brandId: BrandId, viewer: NavViewer = PLATFORM_VIEWER): string[] {
  return hrefsOf(navHtml(brandId, viewer));
}

/**
 * The footer's link columns for one brand and one viewer (the contact/social rows excluded).
 *
 * `hiddenNav: []` is stated at the call site rather than defaulted on the component (#175
 * follow-up): `Footer`'s prop is required precisely so no mount can forget it, and this file is
 * about the *brand* rule, so it renders a build with every gated surface on. The flag half of the
 * same columns is `tests/leaderboard-links.test.ts`.
 *
 * The footer's *navigation* destinations are what this reads — site-relative only. The footer also
 * carries the version badge (issue #269), whose href is the GitHub release tag: a fact about the
 * build, not a column of the footer, so the brand rule ignores the outbound link. `#` placeholders
 * were already excluded for the same reason.
 */
function footerHrefs(brandId: BrandId, viewer: NavViewer = PLATFORM_VIEWER): string[] {
  return hrefsOf(
    renderToStaticMarkup(
      createElement(Footer, { copy: shellPageCopy, viewer, brandId, hiddenNav: [] }),
    ),
  ).filter((href) => href.startsWith("/"));
}

/** The quiz menu exactly as the sidebar rendered it before #156, in order. */
const QUIZ_MENU = [
  "/",
  "/daily-challenge",
  "/categories",
  "/battle",
  "/news",
  "/explore",
  "/tournaments",
  "/leaderboard",
  "/creator-tips",
  "/quiz-discussions",
  "/create/editor",
  "/create/generator",
  "/affiliate",
  "/pricing",
  "/support",
];

/** The destinations that are the quiz product, and must not reach an alignment visitor. */
const QUIZ_ONLY = ["/leaderboard", "/tournaments", "/battle", "/categories", "/explore"];

describe("the quiz brand renders the menu it shipped", () => {
  it("lists the fifteen destinations, in the order it always has", () => {
    expect(navHrefs("quizhub")).toEqual(QUIZ_MENU);
  });

  it("renders the same rows for an elevated viewer — the quiz brand has one menu", () => {
    expect(navHrefs("quizhub", viewerWith("quiz-surfaces"))).toEqual(QUIZ_MENU);
  });
});

describe("the alignment brand's menu is alignment destinations", () => {
  const hrefs = navHrefs("alignsynch");

  it("links only to what exists on this brand today", () => {
    expect(hrefs).toEqual([
      "/dashboard",
      "/how-it-works",
      "/assessment/instances",
      "/assessment/templates",
      "/#templates",
      "/support",
    ]);
  });

  it.each(QUIZ_ONLY)("does not link to %s", (path) => {
    expect(hrefs.filter((href) => href === path || href.startsWith(`${path}/`))).toEqual([]);
  });

  it("keeps every in-page anchor pointing at a band the front page emits", () => {
    const model = alignmentHome(
      alignSynchBrand,
      alignSynchHomeCopy,
      assessments,
      assessmentInstances,
      ALIGN_SYNCH_FEATURED_SLUG,
    );
    const home = renderToStaticMarkup(createElement(AlignmentHomeView, { model }));
    const ids = [...home.matchAll(/id="([^"]*)"/g)].map((match) => match[1]);

    const anchors = hrefs.filter((href) => href.startsWith("/#"));
    // Guard the guard: at least one anchor, or the loop below proves nothing.
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(ids).toContain(anchor.slice(2));
    }
  });
});

describe("the quiz product is filtered, not deleted", () => {
  it("gives a viewer with the quiz capability both menus", () => {
    const hrefs = navHrefs("alignsynch", viewerWith("quiz-surfaces"));
    expect(hrefs.slice(0, 6)).toEqual([
      "/dashboard",
      "/how-it-works",
      "/assessment/instances",
      "/assessment/templates",
      "/#templates",
      "/support",
    ]);
    expect(hrefs.slice(6)).toEqual(QUIZ_MENU);
  });

  it.each(QUIZ_ONLY)("restores %s for that viewer", (path) => {
    expect(navHrefs("alignsynch", viewerWith("quiz-surfaces"))).toContain(path);
  });

  it("grants nothing by default — the stub viewer is a platform user", () => {
    const html = renderToStaticMarkup(
      createElement(AppNav, {
        brandId: "alignsynch",
        viewer: PLATFORM_VIEWER,
        copy: shellPageCopy,
        collapsed: false,
        pathname: "/",
        onNavigate: () => undefined,
      }),
    );
    // The heading over the quiz menu is the fixture's word, and its absence is the proof the
    // elevated branch did not render rather than rendered hidden.
    expect(html).not.toContain(itemLabelOf("quiz-tools"));
  });
});

describe("the console's own rows are a member's, the operator's rows are not", () => {
  // `navViewer(null)` and `navViewer("member")` both answer PLATFORM_VIEWER — one line in
  // `lib/nav.ts` — so this viewer *is* the member's sidebar, and the admin's is the one a role
  // model hands back. Asserting both sides is what keeps "a member does not see /admin/*" from
  // passing because the rows were deleted for everybody.
  const memberHrefs = navHrefs("alignsynch");
  const adminHrefs = navHrefs("alignsynch", viewerWith("admin-console"));

  it("draws every console destination for a member", () => {
    expect(memberHrefs).toContain("/dashboard");
    expect(memberHrefs).toContain("/assessment/instances");
    expect(memberHrefs).toContain("/assessment/templates");
  });

  it("draws no /admin row for a member, and never merely hides one", () => {
    expect(memberHrefs.filter((href) => href.startsWith("/admin"))).toEqual([]);
    const member = navHtml("alignsynch");
    // The labels too: a row rendered `hidden` would still be in the markup, and the refusal is
    // that the member does not learn the surface exists — not that it is invisible.
    expect(member).not.toContain(itemLabelOf("console-gaps"));
    // Delimited, because this row's label ("Relationships") is a substring of the member's own
    // "My Relationships" row: the refusal is about the operator's row, not about the words.
    expect(member).not.toContain(`>${itemLabelOf("admin-instances")}<`);
    expect(member).toContain(`>${itemLabelOf("my-relationships")}<`);
  });

  it("draws both operator rows for an admin, appended after the console's", () => {
    expect(adminHrefs).toEqual([
      "/dashboard",
      "/how-it-works",
      "/assessment/instances",
      "/assessment/templates",
      "/#templates",
      "/support",
      "/admin/gaps",
      "/admin/instances",
    ]);
    const admin = navHtml("alignsynch", viewerWith("admin-console"));
    expect(admin).toContain(itemLabelOf("console-gaps"));
    expect(admin).toContain(itemLabelOf("admin-instances"));
  });

  it("keeps the member's sidebar a prefix of the admin's — same rows, same order", () => {
    expect(adminHrefs.slice(0, memberHrefs.length)).toEqual(memberHrefs);
  });
});

/**
 * The owner's four sidebar notes on `:3002/settings`, as assertions.
 *
 * The order *is* the request — a rail that gains the right rows in the wrong sequence is not the
 * change that was asked for — and the duplicate is what it removes: one row for `/dashboard`, and
 * no AlignSynch console destination on the quiz brand, whose boundary answers those routes with a
 * 404. The rows are brand-conditional by construction (`AppNav` renders one menu or the other),
 * which is why the last case asserts absence rather than a hidden row.
 */
describe("the console rail reads Dashboard, My Relationships, Library, Templates, Support", () => {
  const memberHrefs = navHrefs("alignsynch");

  it("opens on /dashboard and draws that destination exactly once", () => {
    expect(memberHrefs[0]).toBe("/dashboard");
    expect(memberHrefs.filter((href) => href === "/dashboard")).toEqual(["/dashboard"]);
  });

  it("puts Library directly below My Relationships", () => {
    expect(memberHrefs.indexOf("/assessment/templates")).toBe(
      memberHrefs.indexOf("/assessment/instances") + 1,
    );
  });

  it("puts Templates directly above Support", () => {
    expect(memberHrefs.indexOf("/support")).toBe(memberHrefs.indexOf("/#templates") + 1);
  });

  it("keeps the console's rows and their routes off the quiz brand", () => {
    const quiz = navHrefs("quizhub");
    expect(quiz.filter((href) => href.startsWith("/assessment"))).toEqual([]);
    expect(quiz).not.toContain("/dashboard");
    // The guard's guard: the quiz rail is still its own fifteen rows, not an empty list.
    expect(quiz[0]).toBe("/");
    expect(quiz).toHaveLength(QUIZ_MENU.length);
  });
});

describe("the footer columns follow the same rule as the sidebar rows", () => {
  it("keeps the quiz Quick Links and the quiz subjects on the quiz brand", () => {
    const hrefs = footerHrefs("quizhub");
    expect(hrefs).toContain("/leaderboard");
    expect(hrefs.some((href) => href.startsWith("/categories/"))).toBe(true);
  });

  it("replaces them on the alignment brand", () => {
    const hrefs = footerHrefs("alignsynch");
    // The column, then the legal row (#270): Terms and Privacy point at the routes now that they
    // exist, and the Cookie Policy row points at `/privacy` too — §9 of that page is the cookie
    // policy, and a third `/cookies` route is a route nobody asked for (issue #270, refinement 2).
    //
    // `/help` and not `/support`: the footer mounts on the public pages (and four product pages),
    // so its column carries the public help centre — the account page is the rail's row, and a
    // marketing footer pointing at it is the mistake the Help/Support split exists to remove.
    expect(hrefs).toEqual([
      "/#templates",
      "/#questions",
      "/help",
      "/privacy",
      "/terms",
      "/privacy",
    ]);
  });

  it("restores them for a viewer with the quiz capability", () => {
    const hrefs = footerHrefs("alignsynch", viewerWith("quiz-surfaces"));
    expect(hrefs.slice(0, 3)).toEqual(["/#templates", "/#questions", "/help"]);
    expect(hrefs).toContain("/leaderboard");
    expect(hrefs.some((href) => href.startsWith("/categories/"))).toBe(true);
  });
});

/** The fixture's own word for an id, so the test does not restate copy it is checking. */
function itemLabelOf(id: string): string {
  const section = (shellPageCopy.sections ?? []).find((entry) => entry.id === "nav-alignsynch");
  const item = (section?.items ?? []).find((entry) => entry.id === id);
  if (item === undefined) throw new Error(`data/pages/shell.ts declares no "${id}" item`);
  return item.label;
}

describe("the palette searches the brand's records, not the other product's", () => {
  it("returns the quiz index untouched for the quiz brand", () => {
    const index = searchIndexFor("quizhub", PLATFORM_VIEWER);
    expect(index).toBe(searchIndex);
    expect(index.quizzes.length).toBeGreaterThan(0);
  });

  it("indexes no quiz record for an alignment visitor", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    expect(index.quizzes).toEqual([]);
    expect(index.categories).toEqual([]);
    expect(index.creators).toEqual([]);
  });

  it("indexes the instances the build holds, at their real routes", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    const paths = index.pages.map((row) => row.path);
    for (const instance of assessmentInstances) {
      expect(paths).toContain(`/assessment/${instance.slug}`);
    }
    for (const path of paths) {
      expect(isValidRoute(routeManifest, path)).toBe(true);
    }
  });

  it("offers only the pages an alignment visitor can reach", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    const pagePaths = index.pages
      .map((row) => row.path)
      .filter((path) => !path.startsWith("/assessment/"));
    expect(pagePaths.sort()).toEqual([...ALIGNMENT_ROUTES].sort());
  });

  it("finds an assessment by a party's name, and not by quiz vocabulary", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    const hit = querySearchIndex(index, { text: "iris" }).pages[0];
    expect(hit?.path).toBe("/assessment/noor-iris");
    expect(querySearchIndex(index, { text: "leaderboard" }).total).toBe(0);
  });

  it("gives the quiz catalog back to a viewer with the capability", () => {
    const index = searchIndexFor("alignsynch", viewerWith("quiz-surfaces"));
    expect(index.quizzes.length).toBe(searchIndex.quizzes.length);
    expect(index.pages.map((row) => row.path)).toContain("/assessment/avery-rowan");
    expect(index.pages.map((row) => row.path)).toContain("/leaderboard");
  });

  it("labels the field with the brand's own words", () => {
    const quiz = itemLabel(searchSectionFor(shellPageCopy, "quizhub"), "placeholder");
    const alignment = itemLabel(searchSectionFor(shellPageCopy, "alignsynch"), "placeholder");
    expect(quiz).toMatch(/quizzes/i);
    expect(alignment).not.toMatch(/quiz/i);
    expect(alignment).toMatch(/assessments/i);
  });
});
