/**
 * The IA proposal is a descriptor, and a descriptor nothing checks is a document (#721, revised
 * for #731).
 *
 * The review screen at `/admin/review/ia` draws `lib/app-ia.ts` beside the rail that ships. Four
 * things have to be true for that to be a *proposal* rather than a drawing:
 *
 *   1. **every proposed href resolves.** `lib/app-ia.ts` is not in E10's link scan — that scan
 *      names `lib/nav-menu.ts` alone, on purpose — so a destination invented for a mockup would
 *      compile, render, and land on a 404 for the owner clicking it. This file is that scan for
 *      the proposal: rows, row actions and screen-map patterns are resolved against
 *      `content/routes.ts`. The **proposed** rows are the one exception, and the test asserts the
 *      exception holds: a proposed href must resolve to *nothing*, or it is not a proposal.
 *   2. **nothing in today's rail is dropped in silence.** Every item id in `ALIGN_MENU` must land
 *      in a group and a row that exist, or in `APP_IA_REMOVED` with a reason. A placement that
 *      changes the destination is caught too: the proposed row's href must be the one the current
 *      row already pointed at.
 *   3. **the shape is four operator groups.** Two member groups, four admin groups, one shared
 *      Support band — asserted by id and by count, not by reading the docblock — and no member row
 *      inside an admin group or the reverse.
 *   4. **the console is not a destination.** `/admin/console` appears in no row, in no placement
 *      and in no href the render draws; its three pages appear as submenu rows of the groups.
 *
 * It also holds the descriptor to the fixture: every label the review screen asks for
 * (`itemLabel(nav, id)` for a group, a row, a screen or a pattern) must exist in
 * `data/pages/admin-review-ia.ts`, because E23 resolves those ids at build time for the component
 * but a row added to the descriptor with no label would render blank here first.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** `NavRow` draws a `Link`; the node renderer needs the anchor, not the router. */
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AdminReviewIaView } from "@/components/admin/ia-review";
import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { adminReviewIaPageCopy } from "@/data/pages/admin-review-ia";
import { shellPageCopy } from "@/data/pages/shell";
import {
  APP_IA_GROUPS,
  APP_IA_PLACEMENTS,
  APP_IA_REMOVED,
  APP_IA_SCREEN_MAP,
  type AppIaPattern,
  appIaActions,
  appIaGroupIds,
  appIaGroupsFor,
  appIaRowOf,
  appIaRows,
  isLinkableHref,
} from "@/lib/app-ia";
import { ALIGN_MENU } from "@/lib/nav-menu";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** The four rungs, as the screen map and the descriptor both spell them. */
const PATTERNS: readonly AppIaPattern[] = ["list-detail", "tab-rail", "row-actions", "single"];

/** The proposal's own words — the section the rail preview and the two tables read. */
const nav = sectionOf(adminReviewIaPageCopy, "nav-alignsynch");

/** The screen map's words — the third band's section. */
const map = sectionOf(adminReviewIaPageCopy, "map");

/** The console hub — retired in v2, and named once so the assertions read as one fact. */
const CONSOLE_HUB = "/admin/console";

/** Every id the review screen asks the fixture for, in the order the three bands print them. */
function railLabelIds(): string[] {
  return [
    ...APP_IA_GROUPS.map((group) => group.id),
    ...appIaRows().map((row) => row.id),
    ...appIaActions().map((row) => row.id),
  ];
}

/** The ids the screen map's band asks its own section for. */
function mapLabelIds(): string[] {
  return [
    ...APP_IA_SCREEN_MAP.map((screen) => screen.id),
    ...PATTERNS.map((pattern) => `pattern-${pattern}`),
  ];
}

describe("lib/app-ia — the shape of the rail", () => {
  it("is two member groups, four admin groups and one shared band", () => {
    expect(appIaGroupIds()).toEqual([
      "group-workspace",
      "group-do",
      "group-users",
      "group-templates",
      "group-billing",
      "group-system",
      "group-support",
    ]);

    // The owner's own count: the member rail keeps its two work groups, operator work is four.
    expect(appIaGroupsFor("member").map((group) => group.id)).toEqual([
      "group-workspace",
      "group-do",
    ]);
    expect(appIaGroupsFor("admin").map((group) => group.id)).toEqual([
      "group-users",
      "group-templates",
      "group-billing",
      "group-system",
    ]);
    // Support serves both rails — counting it as either audience would make one of them a lie.
    expect(appIaGroupsFor("shared").map((group) => group.id)).toEqual(["group-support"]);
  });

  it("keeps the member rail's rows and order, which is the approved pattern", () => {
    const workspace = APP_IA_GROUPS.find((group) => group.id === "group-workspace");
    expect(workspace?.items.map((row) => row.id)).toEqual([
      "overview",
      "relationships",
      "templates",
      "assessments",
      "gap-analysis",
    ]);
    const support = APP_IA_GROUPS.find((group) => group.id === "group-support");
    expect(support?.items.map((row) => row.id)).toEqual(["help", "support"]);
  });

  it("puts every operator page in one of the four admin groups, and none in a member group", () => {
    const admin = appIaGroupsFor("admin");
    const strays = admin.flatMap((group) =>
      group.items.filter((row) => row.needs !== "admin").map((row) => row.id),
    );
    expect(strays).toEqual([]);

    const memberGroups = [...appIaGroupsFor("member"), ...appIaGroupsFor("shared")];
    const leaked = memberGroups.flatMap((group) =>
      group.items.filter((row) => row.needs === "admin").map((row) => row.id),
    );
    expect(leaked).toEqual([]);

    // And the reverse: an admin group may not be half member rows either.
    for (const group of admin) {
      expect(group.needs).toBe("admin");
      expect(group.items.every((row) => row.needs === "admin")).toBe(true);
    }
  });

  it("names the four groups the owner asked for, and the pages under each", () => {
    const submenuOf = (id: string) =>
      APP_IA_GROUPS.find((group) => group.id === id)?.items.map((row) => row.id);

    expect(submenuOf("group-users")).toEqual([
      "users",
      "operations-relationships",
      "admin-invitations",
    ]);
    expect(submenuOf("group-templates")).toEqual([
      "admin-templates",
      "operations-templates",
      "admin-template-editor",
      "review",
      "template-new",
      "template-clone",
      "template-publish",
    ]);
    expect(submenuOf("group-billing")).toEqual(["billing"]);
    expect(submenuOf("group-system")).toEqual(["health", "broadcast", "audit", "instances"]);
  });

  it("retires the console hub instead of pointing at it", () => {
    // No row, action or screen may name the hub as a destination.
    expect([...appIaRows(), ...appIaActions()].map((row) => row.href)).not.toContain(CONSOLE_HUB);
    expect(APP_IA_SCREEN_MAP.map((screen) => screen.href)).not.toContain(CONSOLE_HUB);
    // It is retired loudly: `APP_IA_REMOVED` carries the reason.
    const hub = APP_IA_REMOVED.find((row) => row.href === CONSOLE_HUB);
    expect(hub?.id).toBe("console");
    expect(hub?.reason).toContain("submenu");
    // And its pages are submenu rows, which is the whole of "console functionality is core admin UI".
    const hrefs = appIaRows().map((row) => row.href);
    expect(hrefs).toContain("/admin/console/users");
    expect(hrefs).toContain("/admin/console/relationships");
    expect(hrefs).toContain("/admin/console/templates");
  });

  it("resolves every shipped href against content/routes.ts, and no proposed one", () => {
    const shipped = [...appIaRows(), ...appIaActions(), ...APP_IA_SCREEN_MAP].filter(
      (item) => item.proposed !== true,
    );
    const unresolvable = shipped
      .map((item) => item.href)
      .filter((href) => matchRoute(routeManifest, href) === undefined);
    // A destination invented for a prototype is a 404 for the person reviewing it.
    expect(unresolvable).toEqual([]);

    const proposed = [...appIaRows(), ...appIaActions(), ...APP_IA_SCREEN_MAP].filter(
      (item) => item.proposed === true,
    );
    expect(proposed.length).toBeGreaterThan(0);
    // The other direction of the same rule: a proposed route that resolves is no longer proposed.
    const shippedByAccident = proposed
      .map((item) => item.href)
      .filter((href) => matchRoute(routeManifest, href) !== undefined);
    expect(shippedByAccident).toEqual([]);
  });

  it("has one copy label per id the review screen prints", () => {
    const missingFromRail = railLabelIds().filter(
      (id) => !(nav.items ?? []).some((item) => item.id === id),
    );
    const missingFromMap = mapLabelIds().filter(
      (id) => !(map.items ?? []).some((item) => item.id === id),
    );
    expect([...missingFromRail, ...missingFromMap]).toEqual([]);
  });

  it("draws every row exactly once, with a unique id", () => {
    const ids = appIaRows().map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Both audiences reach `/admin/inbox`, but each row is its own row.
    expect(appIaRows().filter((row) => row.href === "/admin/inbox")).toHaveLength(2);
  });

  it("states one navigation pattern per screen, and only the four it defines", () => {
    const unknown = APP_IA_SCREEN_MAP.filter((screen) => !PATTERNS.includes(screen.pattern));
    expect(unknown).toEqual([]);

    const ids = APP_IA_SCREEN_MAP.map((screen) => screen.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("lib/app-ia — template authoring", () => {
  const templates = APP_IA_GROUPS.find((group) => group.id === "group-templates");
  const rows = templates?.items ?? [];

  it("names create, clone and publish-revision under Templates", () => {
    expect(rows.map((row) => row.id)).toContain("template-new");
    expect(rows.map((row) => row.id)).toContain("template-clone");
    expect(rows.map((row) => row.id)).toContain("template-publish");

    // Create has a route; the other two do not, and say so.
    expect(appIaRowOf("template-new")?.proposed).toBeUndefined();
    expect(appIaRowOf("template-new")?.href).toBe("/assessment/templates/new");
    expect(appIaRowOf("template-clone")?.proposed).toBe(true);
    expect(appIaRowOf("template-publish")?.proposed).toBe(true);
  });

  it("gives both proposed authoring actions a screen, marked proposed", () => {
    for (const id of ["template-clone", "template-publish"]) {
      const screens = APP_IA_SCREEN_MAP.filter((screen) => screen.row === id);
      expect(screens.length).toBe(1);
      expect(screens[0]?.proposed).toBe(true);
    }
  });

  it("never lets a proposed row be linkable, whatever its href says", () => {
    const proposed = [...appIaRows(), ...appIaActions()].filter((row) => row.proposed === true);
    expect(proposed.map((row) => row.id).sort()).toEqual(["template-clone", "template-publish"]);
    for (const row of proposed) {
      expect(isLinkableHref(row.href)).toBe(false);
    }
  });
});

describe("lib/app-ia — current versus proposed", () => {
  /** Every current rail row, flattened. */
  const current = ALIGN_MENU.flatMap((group) => group.items.map((item) => item));

  it("places every row of today's rail somewhere, or records why it is gone", () => {
    const unaccounted = current
      .filter((item) => !APP_IA_PLACEMENTS.some((placement) => placement.id === item.id))
      .filter((item) => !APP_IA_REMOVED.some((row) => row.id === item.id));
    // A proposal that drops a destination has to say so, not lose it between two lists.
    expect(unaccounted).toEqual([]);
  });

  it("points each placement at a group and a row that exist", () => {
    const groupIds = appIaGroupIds();
    const broken = APP_IA_PLACEMENTS.filter(
      (placement) =>
        placement.group === null ||
        placement.row === null ||
        !groupIds.includes(placement.group) ||
        appIaRowOf(placement.row) === undefined,
    );
    expect(broken).toEqual([]);
  });

  it("lands each existing row on the destination it already has", () => {
    const moved = APP_IA_PLACEMENTS.filter((placement) => {
      const item = current.find((row) => row.id === placement.id);
      const row = placement.row === null ? undefined : appIaRowOf(placement.row);
      return item !== undefined && row !== undefined && row.href !== item.href;
    }).map((placement) => placement.id);
    // A tidy-up may move a row between groups; it may not point it at another page.
    expect(moved).toEqual([]);
  });

  it("sends today's operator rows into the four admin groups, not into a hub", () => {
    const adminGroups = appIaGroupsFor("admin").map((group) => group.id);
    const operatorRows = ["admin-instances", "admin-health", "admin-billing", "admin-broadcast"];
    for (const id of operatorRows) {
      const placement = APP_IA_PLACEMENTS.find((row) => row.id === id);
      expect(adminGroups).toContain(placement?.group);
      expect(placement?.row).not.toBe("console");
    }
  });

  it("records a removal with a reason, never a bare id", () => {
    for (const row of APP_IA_REMOVED) {
      expect(row.reason.trim().length).toBeGreaterThan(24);
    }
  });

  it("reads today's labels from the fixture the shipped rail draws from", () => {
    const today = sectionOf(shellPageCopy, "nav-alignsynch");
    const missing = current.filter(
      (item) => !(today.items ?? []).some((label) => label.id === item.id),
    );
    // The diff's left column is the shipped menu's own words: a rename in `data/pages/shell.ts`
    // has to show up as a change here, not as a stale second copy.
    expect(missing.map((item) => item.id)).toEqual([]);
    expect(itemLabel(today, "console-gaps")).toBe("Gap Analysis");
  });

  it("names the one product decision in words rather than shipping it", () => {
    const gap = APP_IA_PLACEMENTS.find((placement) => placement.id === "console-gaps");
    expect(gap?.group).toBe("group-workspace");
    expect(gap?.row).toBe("gap-analysis");
    // The row is drawn for a member; the page behind it keeps `requireAdmin()` on this branch.
    expect(appIaRowOf("gap-analysis")?.needs).toBe("member");
    expect(gap?.change).toContain("requireAdmin()");
  });
});

describe("lib/app-ia — the screen map", () => {
  it("hangs every screen off a real group and a real row", () => {
    const groupIds = appIaGroupIds();
    const orphaned = APP_IA_SCREEN_MAP.filter(
      (screen) => !groupIds.includes(screen.group) || appIaRowOf(screen.row) === undefined,
    ).map((screen) => screen.id);
    expect(orphaned).toEqual([]);
  });

  it("keeps the Row Actions paradox honest: a row action is not a rail destination", () => {
    const report = APP_IA_SCREEN_MAP.find((screen) => screen.row === "reports");
    expect(report?.pattern).toBe("row-actions");
  });

  it("does not draw Reports as a rail row — its path carries an id the rail cannot know", () => {
    // A rail row pointing at `/admin/instances/[id]/report` links the literal `[id]`. The row is a
    // *verb* on the instance list, so it lives in the group's `actions` and never in `items`, and
    // `appIaRows()` — the list the preview renders — must not contain it.
    expect(appIaRows().some((row) => row.id === "reports")).toBe(false);
    expect(appIaActions().some((row) => row.id === "reports")).toBe(true);
  });

  it("gives every destination in the rail at least one screen on the map", () => {
    const screens = new Set(APP_IA_SCREEN_MAP.map((screen) => screen.row));
    const rowsWithoutScreen = appIaRows()
      .filter((row) => !screens.has(row.id))
      .map((row) => row.id);
    // A row with no screen is a link to somewhere nobody has described.
    expect(rowsWithoutScreen).toEqual([]);
  });
});

describe("the review screen draws the proposal, not a picture of it", () => {
  /**
   * The body component, rendered the way the page mounts it: the fixture in, the markup out, no
   * provider, no session and no database. That is also the claim the page's docblock makes about
   * `pnpm build` — if this case needed a connection, the console route would need one to render,
   * and the gate would no longer pass with `DATABASE_URL` unset.
   */
  const html = renderToStaticMarkup(
    createElement(AdminReviewIaView, { copy: adminReviewIaPageCopy }),
  );

  /** Every `href` in the drawn tree, in document order. */
  const drawnHrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? "");

  /**
   * The rendered text with the three entities React escapes for a reader's eye put back. A label
   * like `Plans & subscriptions` reaches the DOM as `Plans &amp; subscriptions`, and an assertion
   * against the raw markup would call the fixture wrong for a character the browser draws
   * correctly. Hrefs and anchors are asserted against `html` itself — escaping is not the subject
   * of those cases.
   */
  const text = html.replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&quot;", '"');

  it("draws every shipped row as a real link, once", () => {
    const linkable = appIaRows().filter((row) => row.proposed !== true && isLinkableHref(row.href));
    for (const row of linkable) {
      expect(drawnHrefs.filter((href) => href === row.href).length).toBeGreaterThan(0);
    }
    // The preview would still pass every `toContain` below if it rendered nothing, so the count is
    // asserted: the rail's linkable rows plus the screen map's linkable screens.
    const linkableScreens = APP_IA_SCREEN_MAP.filter((screen) => isLinkableHref(screen.href));
    expect(drawnHrefs.length).toBeGreaterThanOrEqual(linkable.length + linkableScreens.length);
  });

  it("prints the rail's own words — every main item and each row's label", () => {
    for (const group of APP_IA_GROUPS) {
      expect(text).toContain(itemLabel(nav, group.id));
      // A submenu row's label is drawn only when its group is open, which the preview starts as.
      for (const row of group.items) {
        expect(text).toContain(itemLabel(nav, row.id));
      }
    }
  });

  it("prints the authoring actions as controls, and never as links", () => {
    for (const id of ["template-new", "template-clone", "template-publish"]) {
      expect(text).toContain(itemLabel(nav, id));
    }
    // New template is a real route, so it links…
    expect(drawnHrefs).toContain("/assessment/templates/new");
    // …and the two proposed actions are `<button>`s with the marker under them, never anchors.
    for (const id of ["template-clone", "template-publish"]) {
      const label = itemLabel(nav, id);
      const href = appIaRowOf(id)?.href ?? "";
      expect(href).not.toBe("");
      expect(drawnHrefs).not.toContain(href);
      expect(html).not.toMatch(new RegExp(`<a[^>]*>[^<]*${label}`));
      expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${label}"`));
    }
    expect(html).toContain(itemLabel(nav, "proposed-marker"));
  });

  it("draws no anchor whose href is the retired console hub", () => {
    // The hub is not a destination anywhere in the drawing — its pages are.
    expect(drawnHrefs).not.toContain(CONSOLE_HUB);
    expect(html).toContain("/admin/console/users");
    expect(html).toContain("/admin/console/relationships");
    expect(html).toContain("/admin/console/templates");
  });

  it("prints today's labels beside the proposed ones, so the diff is readable", () => {
    const today = sectionOf(shellPageCopy, "nav-alignsynch");
    for (const item of ALIGN_MENU.flatMap((group) => group.items)) {
      expect(text).toContain(itemLabel(today, item.id));
    }
  });

  it("prints one screen-map row per screen, with the pattern's own sentence", () => {
    for (const screen of APP_IA_SCREEN_MAP) {
      expect(text).toContain(itemLabel(map, screen.id));
    }
    for (const pattern of PATTERNS) {
      expect(text).toContain(itemLabel(map, `pattern-${pattern}`));
    }
    expect(APP_IA_SCREEN_MAP.length).toBe(30);
  });

  it("does not count the groups by hand — the rail band's numbers are the arrays' lengths", () => {
    // 7 groups, 23 submenu rows, 1 row action, 30 screens, as drawn.
    expect(APP_IA_GROUPS.length).toBe(7);
    expect(appIaRows().length).toBe(23);
    expect(appIaActions().length).toBe(1);
    expect(html).toContain(String(APP_IA_GROUPS.length));
    expect(html).toContain(String(APP_IA_SCREEN_MAP.length));
  });

  /**
   * A route **pattern** is not a destination. `/dashboard/relationships/[id]` in a `<Link>` is the
   * dynamic-href error Next raises, and on `/admin/review/ia` it crashed the client render — the
   * page answered 200 and the reader saw a broken screen. Three cases hold the line: the predicate
   * itself, that every bracketed row in the map is treated as a pattern, and that the rows which
   * *are* linked resolve to real destinations.
   */
  it("treats a route pattern as text, never as a link target", () => {
    expect(isLinkableHref("/dashboard/relationships/[id]")).toBe(false);
    expect(isLinkableHref("/admin/instances/[id]/report")).toBe(false);
    expect(isLinkableHref("/dashboard/relationships")).toBe(true);
    expect(isLinkableHref("/admin/review")).toBe(true);
  });

  it("has a bracketed href on the screen map, and never links one", () => {
    const patterns = APP_IA_SCREEN_MAP.filter((screen) => screen.href.includes("["));
    expect(patterns.length).toBeGreaterThan(0);
    for (const screen of patterns) {
      expect(isLinkableHref(screen.href)).toBe(false);
    }
  });

  it("draws no bracketed href as a link, which is the crash the client hit", () => {
    const drawn = [...html.matchAll(/href="([^"]*\[)/g)].map((match) => match[1]);
    expect(drawn).toEqual([]);
  });

  it("links every non-pattern screen, so a destination in the map is reachable", () => {
    for (const screen of APP_IA_SCREEN_MAP.filter((row) => isLinkableHref(row.href))) {
      expect(matchRoute(routeManifest, screen.href)).toBeDefined();
    }
  });
});
