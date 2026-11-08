/**
 * The IA proposal is a descriptor, and a descriptor nothing checks is a document (#721).
 *
 * The review screen at `/admin/review/ia` draws `lib/app-ia.ts` beside the rail that ships. Three
 * things have to be true for that to be a *proposal* rather than a drawing:
 *
 *   1. **every proposed href resolves.** `lib/app-ia.ts` is not in E10's link scan — that scan
 *      names `lib/nav-menu.ts` alone, on purpose — so a destination invented for a mockup would
 *      compile, render, and land on a 404 for the owner clicking it. This file is that scan for
 *      the proposal: rows *and* screen-map patterns are resolved against `content/routes.ts`.
 *   2. **nothing in today's rail is dropped in silence.** Every item id in `ALIGN_MENU` must land
 *      in a group and a row that exist, or in `APP_IA_REMOVED` with a reason. A placement that
 *      changes the destination is caught too: the proposed row's href must be the one the current
 *      row already pointed at.
 *   3. **the group order is the proposal.** Workspace · Do · Operations · Support — the order the
 *      work happens in, which is the whole of the fix to a flat list of thirteen rows.
 *
 * It also holds the descriptor to the fixture: every label the review screen asks for
 * (`itemLabel(nav, id)` for a group, a sub-group, a row, a screen or a pattern) must exist in
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

/** Every id the review screen asks the fixture for, in the order the three bands print them. */
function railLabelIds(): string[] {
  return [
    ...APP_IA_GROUPS.map((group) => group.id),
    ...APP_IA_GROUPS.flatMap((group) => group.subGroups.map((subGroup) => subGroup.id)),
    ...appIaRows().map((row) => row.id),
  ];
}

/** The ids the screen map's band asks its own section for. */
function mapLabelIds(): string[] {
  return [
    ...APP_IA_SCREEN_MAP.map((screen) => screen.id),
    ...PATTERNS.map((pattern) => `pattern-${pattern}`),
  ];
}

describe("lib/app-ia — the proposed rail", () => {
  it("puts the four capabilities first, in the lifecycle's order", () => {
    expect(appIaGroupIds()).toEqual([
      "group-workspace",
      "group-do",
      "group-operations",
      "group-support",
    ]);

    const workspace = APP_IA_GROUPS[0];
    expect(workspace?.items.map((row) => row.id)).toEqual([
      "overview",
      "relationships",
      "templates",
      "assessments",
      "gap-analysis",
    ]);
  });

  it("opens Operations with the console and sub-groups the rest", () => {
    const operations = APP_IA_GROUPS.find((group) => group.id === "group-operations");
    expect(operations?.items.map((row) => row.id)).toEqual(["console"]);
    expect(operations?.subGroups.map((subGroup) => subGroup.id)).toEqual([
      "people",
      "content",
      "sessions",
      "money",
      "system",
    ]);
  });

  it("resolves every proposed href against content/routes.ts", () => {
    const unresolvable = [
      ...appIaRows().map((row) => row.href),
      ...APP_IA_SCREEN_MAP.map((s) => s.href),
    ].filter((href) => matchRoute(routeManifest, href) === undefined);
    // A destination invented for a prototype is a 404 for the person reviewing it.
    expect(unresolvable).toEqual([]);
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

describe("lib/app-ia — current versus proposed", () => {
  /** Every current rail row, flattened, with the group it hangs under. */
  const current = ALIGN_MENU.flatMap((group) => group.items.map((item) => item));

  it("places every row of today's rail somewhere, or records why it is gone", () => {
    const unaccounted = current
      .filter((item) => !APP_IA_PLACEMENTS.some((placement) => placement.id === item.id))
      .filter((item) => !APP_IA_REMOVED.some((row) => row.id === item.id));
    // The owner's complaint was that the console had no navigation, never that it had too many
    // rows — a proposal that drops a destination has to say so, not lose it between two lists.
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

  it("records a removal with a reason, never a bare id", () => {
    for (const row of APP_IA_REMOVED) {
      expect(row.reason.length).toBeGreaterThan(0);
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

  it("draws every proposed row as a real link, once", () => {
    for (const row of appIaRows()) {
      expect(drawnHrefs.filter((href) => href === row.href).length).toBeGreaterThan(0);
    }
    // The rail preview is nineteen rows and the screen map is twenty-six more screens — of which the
    // pattern rows print as code, because a pattern is not a destination. A preview that rendered
    // nothing would still pass every `toContain` above, so the count is asserted.
    const linkableScreens = APP_IA_SCREEN_MAP.filter((screen) => isLinkableHref(screen.href));
    expect(drawnHrefs.length).toBeGreaterThanOrEqual(appIaRows().length + linkableScreens.length);
  });

  it("prints the rail's own words — the group headings and each row's label", () => {
    for (const group of APP_IA_GROUPS) {
      expect(html).toContain(itemLabel(nav, group.id));
      for (const subGroup of group.subGroups) {
        expect(html).toContain(itemLabel(nav, subGroup.id));
      }
    }
    for (const row of appIaRows()) {
      expect(html).toContain(itemLabel(nav, row.id));
    }
  });

  it("prints today's labels beside the proposed ones, so the diff is readable", () => {
    const today = sectionOf(shellPageCopy, "nav-alignsynch");
    for (const item of ALIGN_MENU.flatMap((group) => group.items)) {
      expect(html).toContain(itemLabel(today, item.id));
    }
  });

  it("prints one screen-map row per screen, with the pattern's own sentence", () => {
    expect(APP_IA_SCREEN_MAP.length).toBe(26);
    for (const screen of APP_IA_SCREEN_MAP) {
      expect(html).toContain(itemLabel(map, screen.id));
    }
    for (const pattern of PATTERNS) {
      expect(html).toContain(itemLabel(map, `pattern-${pattern}`));
    }
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

  it("links every non-pattern row, so a destination in the map is reachable", () => {
    for (const screen of APP_IA_SCREEN_MAP.filter((row) => isLinkableHref(row.href))) {
      expect(matchRoute(routeManifest, screen.href)).toBeDefined();
    }
  });
});
