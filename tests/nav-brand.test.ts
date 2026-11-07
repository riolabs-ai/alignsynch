/**
 * The shell's navigation is brand- and role-aware (issue #156).
 *
 * The failure this pins: `BRAND=alignsynch` rendered the alignment front page, and its first
 * click — Leaderboard, Tournaments, Battle, Categories, Explore — landed in the quiz product.
 * The fix is one navigation definition filtered by brand and capability, and the claims below
 * are the four that make it a fix rather than a rewrite:
 *
 *   1. the quiz brand's menu is the menu it shipped: the same fifteen destinations, in order;
 *   2. the alignment brand's menu is alignment destinations only, and every row is a route this
 *      build serves inside the dashboard — the rail carries no anchor into the marketing site
 *      since #542 moved Support, Help and Library under `/dashboard/*`;
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
import {
  ALIGNMENT_ROUTES,
  type NavViewer,
  navViewer,
  PLATFORM_VIEWER,
  viewerWith,
} from "@/lib/nav";
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

/**
 * The alignment rail's four member destinations, in order (#620).
 *
 * **#620 took the Workspace group from four rows to two.** `My Relationships` is
 * `/dashboard/relationships` (the relationship *and* its assessment) and `Templates` is
 * `/dashboard/templates` (the catalogue and the member's own rows, as two tabs). The rows this
 * replaced are gone: `/dashboard` (the Overview still answers, it is simply not a rail row),
 * `My Templates` (now the second tab) and `Library` (now a 308 to that tab — the page is deleted,
 * because a redirect may not shadow one).
 *
 * It is one constant rather than four literals per case because three cases assert the same rows;
 * a second copy is how a menu edit lands in one expectation and not the others.
 */
const ALIGNMENT_MENU = [
  "/dashboard/relationships",
  "/dashboard/templates",
  "/dashboard/help",
  "/dashboard/support",
];

/**
 * The operator's group, in order (#542 phase 2): the console hub first — the row that had no home
 * anywhere in the UI before this card — then the five the rail already carried, then the two staff
 * surfaces that were also unreachable, and the audit log last.
 */
const ADMIN_MENU = [
  "/admin/console",
  "/admin/instances",
  "/admin/gaps",
  "/admin/inbox",
  "/admin/health",
  "/admin/billing",
  "/admin/broadcast",
  "/admin/audit",
];

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
    expect(hrefs).toEqual(ALIGNMENT_MENU);
  });

  it.each(QUIZ_ONLY)("does not link to %s", (path) => {
    expect(hrefs.filter((href) => href === path || href.startsWith(`${path}/`))).toEqual([]);
  });

  /**
   * #542 phase 1 — the rail carries no marketing anchor any more, and every row is in-app.
   *
   * It used to carry exactly one anchor (`/#templates`), and the case here held it to an `id` the
   * rendered front page emitted. That row reads the catalogue at `/assessment/templates` now, so
   * the anchor rule moves to the footer — still scrolling the front page for `How it works` — and
   * the rail is held to the stronger claim: **no row leaves the workspace**. That is what E39
   * reads from the other side (a dashboard file linking to `app/(marketing)` must be a marked
   * departure, and a rail with none has nothing to mark).
   */
  it("points every in-page anchor still in the chrome at a band the front page emits", () => {
    const model = alignmentHome(
      alignSynchBrand,
      alignSynchHomeCopy,
      assessments,
      assessmentInstances,
      ALIGN_SYNCH_FEATURED_SLUG,
    );
    const home = renderToStaticMarkup(createElement(AlignmentHomeView, { model }));
    const ids = [...home.matchAll(/id="([^"]*)"/g)].map((match) => match[1]);

    // The rail links no anchor at all any more, which is the change this card made.
    expect(hrefs.filter((href) => href.startsWith("/#"))).toEqual([]);
    // …and no row is a route the marketing group serves, either: Support, How it works and
    // Library are `/dashboard/*` since #542, and Templates reads the page this build serves.
    for (const href of hrefs) {
      expect(href.startsWith("/dashboard") || href.startsWith("/assessment")).toBe(true);
    }

    const anchors = footerHrefs("alignsynch").filter((href) => href.startsWith("/#"));
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
    expect(hrefs.slice(0, 4)).toEqual(ALIGNMENT_MENU);
    expect(hrefs.slice(4)).toEqual(QUIZ_MENU);
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
  // `navViewer(null)` and `navViewer("member")` both answer the member menu — one line in
  // `lib/nav.ts` — so this viewer *is* the member's sidebar, and the admin's is what the role
  // hands back (#542 phase 2: the rung, not a capability, decides the rows).
  const memberHrefs = navHrefs("alignsynch");
  const adminHrefs = navHrefs("alignsynch", navViewer("admin"));

  it("draws exactly two workspace rows for a member — the two #620 merged to", () => {
    expect(memberHrefs).toContain("/dashboard/relationships");
    expect(memberHrefs).toContain("/dashboard/templates");
    // The three retired rows: the Overview is not a rail row any more, the library is a redirect,
    // and "My Templates" is the tab behind `/dashboard/templates`.
    expect(memberHrefs).not.toContain("/dashboard");
    expect(memberHrefs).not.toContain("/dashboard/library");
    expect(memberHrefs.filter((href) => href.startsWith("/dashboard/")).slice(0, 2)).toEqual([
      "/dashboard/relationships",
      "/dashboard/templates",
    ]);
  });

  it("draws no /admin row for a member, and never merely hides one", () => {
    expect(memberHrefs.filter((href) => href.startsWith("/admin"))).toEqual([]);
    const member = navHtml("alignsynch");
    // The labels too: a row rendered `hidden` would still be in the markup, and the refusal is
    // that the member does not learn the surface exists — not that it is invisible.
    expect(member).not.toContain(itemLabelOf("console-gaps"));
    expect(member).not.toContain(itemLabelOf("console"));
    // Delimited, because this row's label ("Relationships") is a substring of the member's own
    // "My Relationships" row: the refusal is about the operator's row, not about the words.
    expect(member).not.toContain(`>${itemLabelOf("admin-instances")}<`);
    expect(member).toContain(`>${itemLabelOf("my-relationships")}<`);
  });

  it("draws every operator row for an admin, in one group, after the member's rows", () => {
    /**
     * #542 phase 2 replaced #539 item 10's order — operator group first — with the card's own:
     * the reader's work, then help, then the staff group. What did not change is that the rows
     * are one labelled group, and that the console hub leads it.
     */
    expect(adminHrefs).toEqual([...ALIGNMENT_MENU, ...ADMIN_MENU]);
    const admin = navHtml("alignsynch", navViewer("admin"));
    for (const href of ADMIN_MENU) {
      expect(admin).toContain(`href="${href}"`);
    }
    // The three group labels, from the fixture, in order: workspace, support, admin.
    const workspace = admin.indexOf(itemLabelOf("group-app"));
    const support = admin.indexOf(itemLabelOf("group-support"));
    const staff = admin.indexOf(itemLabelOf("group-admin"));
    expect(workspace).toBeGreaterThan(-1);
    expect(workspace).toBeLessThan(support);
    expect(support).toBeLessThan(staff);
  });

  it("keeps the member's rows a prefix of the admin's — same rows, same order", () => {
    // The staff group is additive and comes last, so the member's six rows keep their place at
    // the front of the admin's rail — the difference is the group, not a re-sort.
    expect(adminHrefs.slice(0, memberHrefs.length)).toEqual(memberHrefs);
  });

  it("draws the console hub for an owner too — above an admin is not outside it", () => {
    // `owner` outranks `admin` on the ladder, so every console page opens for it
    // (`requireRole("admin")` is a rank comparison). A menu that keyed on `role === "admin"`
    // would have hidden the whole group from the one person who can reach all of it.
    expect(navHrefs("alignsynch", navViewer("owner"))).toContain("/admin/console");
  });

  it("gives a support seat the one staff row it works, and no page it would be refused", () => {
    const supportHrefs = navHrefs("alignsynch", navViewer("support"));
    expect(supportHrefs.filter((href) => href.startsWith("/admin"))).toEqual(["/admin/inbox"]);
  });
});

/**
 * The order the Workspace group states: the reader's work first, then the duplicate-free rule.
 *
 * The duplicate is what the first case removes: one row for `/dashboard`, and no AlignSynch console
 * destination on the quiz brand, whose boundary answers those routes with a 404. The rows are
 * brand-conditional by construction (`AppNav` renders one menu or the other), which is why the last
 * case asserts absence rather than a hidden row.
 */
describe("the workspace group reads My Relationships, Templates", () => {
  const memberHrefs = navHrefs("alignsynch");

  it("opens on My Relationships — the first row of the two that are a member's work", () => {
    expect(memberHrefs[0]).toBe("/dashboard/relationships");
    expect(memberHrefs.filter((href) => href === "/dashboard/relationships")).toEqual([
      "/dashboard/relationships",
    ]);
  });

  it("puts Templates directly under My Relationships, and the catalogue tab inside it", () => {
    const at = (href: string) => memberHrefs.indexOf(href);
    expect(at("/dashboard/templates")).toBe(at("/dashboard/relationships") + 1);
    // The shelf the row opens is the catalogue tab of that one destination — not a second row.
    expect(memberHrefs).not.toContain("/assessment/templates");
  });

  it("puts the support pair after the workspace rows, Help first", () => {
    const at = (href: string) => memberHrefs.indexOf(href);
    expect(at("/dashboard/help")).toBe(at("/dashboard/templates") + 1);
    expect(at("/dashboard/support")).toBe(at("/dashboard/help") + 1);
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
      "/templates",
      "/#questions",
      "/help",
      // The contact band's one link, to the form (owner, 2026-11-02): the band no longer prints
      // a mailbox, so the destination is the same public page the column's Help row opens.
      "/help",
      "/privacy",
      "/terms",
      "/privacy",
    ]);
  });

  it("restores them for a viewer with the quiz capability", () => {
    const hrefs = footerHrefs("alignsynch", viewerWith("quiz-surfaces"));
    expect(hrefs.slice(0, 3)).toEqual(["/templates", "/#questions", "/help"]);
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
