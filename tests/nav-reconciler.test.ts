/**
 * The reconciler — the derived half of the rail, and the three ways to look at it (#862).
 *
 * `data/nav-menu.json` says what the rail draws. `app/**` says what doors the build has. Neither
 * file can see the other, and that gap is how `/admin/console` shipped with no row anywhere in the
 * UI (#542 phase 2) and how a page can still be added without any menu changing. So the assertions
 * here are about the *subtraction*, and they are driven from values rather than from the tree —
 * `scripts/__tests__/nav-inventory.test.ts` owns the walk that produces the inventory, and
 * `data:check` E43 owns the real tree:
 *
 *   1. a route in the tree that the document does not place **appears in `Unplaced`** — that is the
 *      whole mechanism, and the reason a dead end is impossible by construction instead of by review;
 *   2. `NAV_SOURCE=derived` ignores the document entirely — the truth test (`what does this tree
 *      actually contain?`), which is what a person asks when the rail and the tree disagree;
 *   3. `NAV_SOURCE=document` drops `Unplaced` — trust the file, see the rail the owner wrote;
 *   4. a `hidden` row is still *drawn* in `Unplaced`, and **only for `owner`** — losing a door on
 *      purpose is fine, discovering it is not, and a member's rail is not a to-do list.
 *
 * The last two blocks are the real document's own numbers: the day a route is added without a row,
 * the census moves and this file says so before the gate does.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_NAV_SOURCE,
  NAV_INVENTORY_VERSION,
  NAV_SOURCES,
  coverageLine,
  coverageOf,
  inJurisdiction,
  navSourceFrom,
  unplacedOf,
  type NavDocumentView,
  type NavInventory,
  type NavSurface,
} from "@/lib/nav-reconcile";
import { ALIGN_MENU, BUILD_NAV_SOURCE, menuFor, navCoverage, railFor } from "@/lib/nav-menu";
import { USER_ROLES, type UserRole } from "@/content/role-ladder";

/** A route as the walker would hand it back — the two derived facts, and where it lives. */
function surface(href: string, overrides: Partial<NavSurface> = {}): NavSurface {
  return {
    href,
    file: `app/(mainlayout)${href}/page.tsx`,
    group: "(mainlayout)",
    boundary: "any",
    console: false,
    roleFloor: null,
    ...overrides,
  };
}

const inventoryOf = (...surfaces: NavSurface[]): NavInventory => ({
  walked: surfaces.length,
  surfaces,
});

describe("the reconciler", () => {
  /**
   * The mechanism, in one case: the tree knows a door the document does not. Before #862 that was a
   * silent gap; now it is a row in `Unplaced` and a red gate (E43), and the row carries the file, so
   * the finding says where to look.
   */
  it("draws a route the tree has and the document does not place", () => {
    const document: NavDocumentView = { rows: [{ href: "/dashboard" }] };
    const inventory = inventoryOf(surface("/dashboard"), surface("/admin/growth"));

    const unplaced = unplacedOf(document, inventory, "both");
    expect(unplaced.map((entry) => entry.href)).toEqual(["/admin/growth"]);
    expect(unplaced[0]?.kind).toBe("unaccounted");
    expect(unplaced[0]?.reason).toContain("app/(mainlayout)/admin/growth/page.tsx");

    // …and the gate's view of the same pair: one unjustified surface, named.
    const coverage = coverageOf(inventory, document);
    expect(coverage.unjustified).toEqual([
      "/admin/growth (app/(mainlayout)/admin/growth/page.tsx) is in the tree and neither placed in a group nor unlisted",
    ]);
    expect(coverage.placed).toBe(1);
  });

  it("counts an `unlisted` surface as accounted for, and refuses one with no reason", () => {
    const inventory = inventoryOf(surface("/admin/growth"));
    expect(
      coverageOf(inventory, {
        rows: [],
        unlisted: [{ href: "/admin/growth", reason: "owner's ruling (#1095)" }],
      }).unjustified,
    ).toEqual([]);

    expect(
      coverageOf(inventory, { rows: [], unlisted: [{ href: "/admin/growth", reason: " " }] })
        .unjustified,
    ).toContain('unlisted "/admin/growth" carries no reason — name what it is instead');
  });

  /** A stale statement hides a door behind a reason nobody can read, so it is its own finding. */
  it("refuses an `unlisted` entry naming a page the tree does not render", () => {
    const coverage = coverageOf(inventoryOf(surface("/dashboard")), {
      rows: [{ href: "/dashboard" }],
      unlisted: [{ href: "/nowhere", reason: "kept for a page that was deleted" }],
    });
    expect(coverage.unjustified).toEqual([
      'unlisted "/nowhere" renders no page.tsx in the tree — a stale statement',
    ]);
  });

  /**
   * The jurisdiction rule: two facts, both derived. A quiz-only surface answers 404 on this build, so
   * a rail row would advertise a door the product does not sell — and a marketing page has its own
   * chrome, so the rail is not its navigation.
   */
  it("ignores quiz-only routes and everything outside the shell", () => {
    const inventory = inventoryOf(
      surface("/battle", { boundary: "quiz" }),
      surface("/pricing", { group: "(marketing)", file: "app/(marketing)/pricing/page.tsx" }),
      surface("/admin/console"),
    );
    expect(inventory.surfaces.filter(inJurisdiction).map((entry) => entry.href)).toEqual([
      "/admin/console",
    ]);
    expect(unplacedOf({ rows: [] }, inventory, "both").map((entry) => entry.href)).toEqual([
      "/admin/console",
    ]);
    // The census still counts what it looked at, so `0 unaccounted` has its denominator.
    const coverage = coverageOf(inventory, { rows: [] });
    expect(coverageLine(coverage)).toBe(
      "3 page.tsx walked, 3 static routes, 1 in the rail's jurisdiction (0 placed, 0 unlisted, 1 unaccounted), 1 quiz-only, 1 outside the shell",
    );
  });
});

describe("NAV_SOURCE", () => {
  it("defaults to `both` and refuses to invent a fourth value", () => {
    expect(DEFAULT_NAV_SOURCE).toBe("both");
    expect(NAV_SOURCES).toEqual(["document", "derived", "both"]);
    expect(navSourceFrom(undefined)).toBe("both");
    expect(navSourceFrom("derived")).toBe("derived");
    expect(navSourceFrom("document")).toBe("document");
    expect(navSourceFrom("everything")).toBe("both");
    // The build's own value is one of the three — never `undefined` at a call site.
    expect(NAV_SOURCES).toContain(BUILD_NAV_SOURCE);
  });

  /**
   * `derived` is the truth test: **the document is not consulted at all.** The rail's groups are
   * empty and every route in the tree is a row, which is the question a person asks when a rail and
   * a tree disagree — "what doors does this build actually have?"
   */
  it("`derived` ignores the document, and draws the whole tree instead", () => {
    const document: NavDocumentView = {
      rows: [{ href: "/dashboard" }, { href: "/admin/growth", hidden: true, reason: "r" }],
      unlisted: [{ href: "/settings", reason: "account menu" }],
    };
    const inventory = inventoryOf(
      surface("/dashboard"),
      surface("/admin/growth"),
      surface("/settings"),
      surface("/battle", { boundary: "quiz" }),
    );

    const derived = unplacedOf(document, inventory, "derived");
    expect(derived.map((entry) => entry.href)).toEqual([
      "/dashboard",
      "/admin/growth",
      "/settings",
    ]);
    expect(derived.every((entry) => entry.reason.includes("NAV_SOURCE=derived"))).toBe(true);
    // The quiz-only route is still nobody's row.
    expect(derived.map((entry) => entry.href)).not.toContain("/battle");

    // The rail itself: no groups from the document, and the unplaced list is the whole tree.
    const rail = railFor("owner", undefined, "derived");
    expect(rail.groups).toEqual([]);
    expect(rail.unplaced).toHaveLength(navCoverage().inJurisdiction);
  });

  /** `document` trusts the file: the rail the owner wrote, and no findings drawn beside it. */
  it("`document` drops `Unplaced` entirely", () => {
    for (const role of USER_ROLES) {
      const rail: { unplaced: readonly unknown[]; groups: unknown[] } = railFor(
        role,
        undefined,
        "document",
      );
      expect(rail.unplaced).toEqual([]);
      expect(rail.groups).toEqual(menuFor(role));
    }
  });

  /**
   * `both` — the default — appends the findings to the rail without touching the document's rows.
   * The comparison is the point: the groups are byte-for-byte `menuFor`'s, so an operator's rail did
   * not move when the derived half landed.
   */
  it("`both` keeps the document's groups and adds the findings beside them", () => {
    for (const role of USER_ROLES) {
      const rail = railFor(role, undefined, "both");
      expect(rail.groups).toEqual(menuFor(role));
      expect(rail.groups).toEqual(railFor(role, undefined, "document").groups);
    }
    expect(railFor("owner", undefined, "both").unplaced.length).toBeGreaterThan(0);
  });
});

describe("the Unplaced group belongs to the owner", () => {
  /**
   * A `hidden` row is a door the document kept and stopped drawing, with its reason beside it. The
   * owner is the role that has to know it is there — and the one role whose rail may carry a
   * statement about the menu — so it is drawn for `owner` and for nobody else. A member's rail is a
   * set of destinations, not a to-do list.
   *
   * Today the document has **no** `hidden` row: `/admin/growth` is `unlisted` (it never had a row
   * since #1095), so the real rail's `Unplaced` list is the 19 `unlisted` surfaces. The case asserts
   * the gate — owner draws them, every other rung draws none — and the synthetic case below pins the
   * `hidden` kind itself, which is the field a future "take this row off the rail" edit uses.
   */
  it("draws the findings for `owner` only", () => {
    for (const role of USER_ROLES) {
      const rail = railFor(role as UserRole, undefined, "both");
      if (role === "owner") {
        expect(rail.unplaced.map((entry) => entry.href)).toContain("/admin/growth");
      } else {
        expect(rail.unplaced).toEqual([]);
      }
    }
    // Nobody signed in is the member menu, and it carries no findings either.
    expect(railFor(null, undefined, "both").unplaced).toEqual([]);
  });

  it("says a hidden row is hidden, and keeps the reason it was given", () => {
    const inventory = inventoryOf(surface("/admin/growth"));
    const [entry] = unplacedOf(
      { rows: [{ href: "/admin/growth", hidden: true, reason: "charts a simulated business" }] },
      inventory,
      "both",
    );
    expect(entry).toMatchObject({
      href: "/admin/growth",
      kind: "hidden",
      reason: "charts a simulated business",
    });
    // The surface is accounted for, so the gate is quiet about it — hidden is a statement, not a gap.
    expect(
      coverageOf(inventory, {
        rows: [{ href: "/admin/growth", hidden: true, reason: "charts a simulated business" }],
      }).unjustified,
    ).toEqual([]);
  });
});

describe("the real document against the real tree", () => {
  /**
   * The acceptance statement, as an assertion: the census over the committed inventory and
   * `data/nav-menu.json` has **no** unaccounted route, and every remainder is an `unlisted` entry
   * with a reason. When a page is added without a row, this case fails naming it — one step ahead of
   * E43, which fails the same way in the gate.
   */
  it("accounts for every route in the shell's jurisdiction", () => {
    const coverage = navCoverage();
    expect(coverage.unjustified).toEqual([]);
    expect(coverage.unaccounted).toEqual([]);
    expect(coverage.inJurisdiction).toBe(coverage.placed + coverage.unlisted);
    expect(coverage.walked).toBeGreaterThan(coverage.surfaces);
    expect(coverage.quizOnly).toBeGreaterThan(0);
  });

  it("reads a committed inventory the build understands", () => {
    // The file is generated (`pnpm nav:menu --inventory`); E43 compares it with a fresh walk, and
    // this case pins the one field a version mismatch would silently reinterpret.
    expect(navCoverage().walked).toBeGreaterThan(0);
    expect(NAV_INVENTORY_VERSION).toBe(1);
  });

  it("leaves the drawn rail exactly as the document wrote it", () => {
    // #862 must not add, rename or re-order a group: `ALIGN_MENU` is the document, unchanged, and
    // the findings are a separate list beside it.
    expect(railFor("owner").groups).toEqual(ALIGN_MENU.map((group) => ({ ...group })));
    expect(railFor("member").groups.map((group) => group.id)).toEqual([
      "group-app",
      "group-support",
    ]);
  });
});
