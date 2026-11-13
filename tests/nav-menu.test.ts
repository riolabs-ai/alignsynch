/**
 * The rail's menu is data, and the data is a role-constrained ladder (#542 phase 2).
 *
 * The defect this file exists for, measured on `main`: `/admin/console` had **no row anywhere in
 * the UI** — the operator's five destinations were a separately gated block of JSX, and the hub
 * every one of them hangs off was in neither list. An admin could reach their own console only by
 * typing the URL.
 *
 * So the assertions are about the *descriptor* first (`lib/nav-menu.ts` — pure, no React) and about
 * the rendered rail second:
 *
 *   1. every row names a real fixture label and a real route: a row is not a string nobody checks;
 *   2. the Admin group leads with the inbox and ends with `/admin/audit`, and every `/admin`
 *      destination is in a staff group — the operator group, or one of the two staff rows #929
 *      moved into Support;
 *   3. the four rungs produce four different menus, each one the whole document **in the
 *      document's order** with the rows that seat cannot reach removed — `needs` gates
 *      visibility, never the sequence (#929);
 *   4. the rendered rail agrees with `menuFor`, because a descriptor nothing renders is a document.
 *
 * **Membership is not authorisation**, and this file does not pretend otherwise: every `/admin/*`
 * page refuses a member with `notFound()` (`lib/auth/require-role.ts`), and every audited write
 * re-asks its floor inside the transaction (`lib/admin/act.ts`). What is proven here is that the
 * rail does not *advertise* a surface the reader would be refused — a row pointing at a 404 is a
 * row that tells a stranger the surface exists.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AppNav } from "@/components/layout/nav-menus";
import {
  NAV_DOCUMENT_VERSION,
  NAV_ICON_NAMES,
  zNavDocument,
  type NavRowRecord,
} from "@/content/nav";
import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import navDocument from "@/data/nav-menu.json";
import { shellPageCopy } from "@/data/pages/shell";
import { navViewer } from "@/lib/nav";
import { ALIGN_MENU, allItems, menuFor } from "@/lib/nav-menu";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { USER_ROLES, roleAdmits, type UserRole } from "@/content/role-ladder";

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/** The alignment rail's markup for one role — the same mount the shell uses. */
function railHtml(role: UserRole | null): string {
  return renderToStaticMarkup(
    createElement(AppNav, {
      brandId: "alignsynch",
      viewer: navViewer(role),
      copy: shellPageCopy,
      collapsed: false,
      pathname: "/dashboard",
      onNavigate: () => undefined,
    }),
  );
}

/** The rail's destinations for one role. */
function railHrefs(role: UserRole | null): string[] {
  return hrefsOf(railHtml(role));
}

/** The aligned menu's rows for one role, flattened. */
function hrefsFor(role: UserRole | null): string[] {
  return menuFor(role).flatMap((group) => group.items.map((item) => item.href));
}

describe("the menu descriptor", () => {
  it("names a fixture label that exists — the words are the shell's, not the rail's", () => {
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const ids = new Set(nav.items?.map((item) => item.id) ?? []);
    for (const group of ALIGN_MENU) {
      // Throws on a missing id, which is the failure mode this case is for.
      expect(itemLabel(nav, group.label)).toBeTruthy();
      for (const item of group.items) {
        expect(ids.has(item.id), `${item.href} names id "${item.id}"`).toBe(true);
        expect(itemLabel(nav, item.id)).toBeTruthy();
      }
    }
  });

  it("points every row at a route the router resolves", () => {
    for (const item of allItems()) {
      expect(matchRoute(routeManifest, item.href), `${item.href} is not a route`).toBeDefined();
    }
  });

  it("draws no section twice — one row per destination", () => {
    const hrefs = allItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  /**
   * #929 — the owner's order, restored: the inbox leads the operator group and the log closes it.
   * The two rows that left for `group-support` (the review shelf, the health page) are asserted
   * **absent** here and present in Support below, because "moved" — not "deleted" — is the claim.
   */
  it("leads the Admin group with the inbox and ends it with the audit log", () => {
    const admin = ALIGN_MENU.find((group) => group.label === "group-admin");
    expect(admin).toBeDefined();
    expect(admin?.items.map((item) => item.href)).toEqual([
      "/admin/inbox",
      "/admin/console",
      "/admin/instances",
      "/admin/gaps",
      "/admin/growth",
      "/admin/billing",
      "/admin/broadcast",
      "/admin/docs",
      "/admin/audit",
    ]);
  });

  /**
   * #929 puts exactly **two** admin-gated rows inside `group-support` — the review shelf and the
   * health page. So the invariant is narrower than it was and exact: every `/admin` destination is
   * either in `group-admin` or one of those two named rows. A third escaping row, or one escaping
   * into a member group, is still a failure.
   */
  it("keeps every /admin destination in a staff group, and only two outside the operator group", () => {
    const STAFF_ROWS_IN_SUPPORT = ["/admin/review", "/admin/health"];
    const supportHrefs = (
      ALIGN_MENU.find((group) => group.label === "group-support")?.items ?? []
    ).map((item) => item.href);
    expect(supportHrefs.filter((href) => href.startsWith("/admin"))).toEqual(STAFF_ROWS_IN_SUPPORT);

    for (const group of ALIGN_MENU) {
      if (group.label === "group-admin" || group.label === "group-support") continue;
      for (const item of group.items) {
        expect(item.href.startsWith("/admin"), `${item.href} sits outside the staff groups`).toBe(
          false,
        );
      }
    }
    for (const item of allItems().filter((candidate) => candidate.href.startsWith("/admin"))) {
      const staffGroupRow = (
        ALIGN_MENU.find((group) => group.label === "group-admin")?.items ?? []
      ).some((candidate) => candidate.href === item.href);
      expect(
        staffGroupRow || STAFF_ROWS_IN_SUPPORT.includes(item.href),
        `${item.href} is in neither staff group`,
      ).toBe(true);
    }
  });
});

describe("the ladder decides the rows", () => {
  /** The four rungs, in order, with the rung each row's floor is met by. */
  const MENUS: Record<UserRole, string[]> = {
    member: hrefsFor("member"),
    support: hrefsFor("support"),
    admin: hrefsFor("admin"),
    owner: hrefsFor("owner"),
  };

  /** #929 — the operator group, as the owner ordered it: the inbox first, the log last. */
  const ADMIN_GROUP = [
    "/admin/inbox",
    "/admin/console",
    "/admin/instances",
    "/admin/gaps",
    "/admin/growth",
    "/admin/billing",
    "/admin/broadcast",
    "/admin/docs",
    "/admin/audit",
  ];

  /** #929 — the Support group, in the owner's order: two staff rows among the help pair. */
  const SUPPORT_GROUP = ["/admin/review", "/dashboard/help", "/admin/health", "/dashboard/support"];

  /** The three Workspace rows every rung above it shares (#620, #877). */
  const WORKSPACE = ["/dashboard/relationships", "/assessments", "/dashboard/templates"];

  /**
   * **The rule the amendment added, and the one that is easy to lose in a "just move these six
   * rows" edit.** `needs` gates visibility, never the sequence: what a role sees is the document
   * filtered, so the document's order is the *only* order any role gets. A per-role reshuffle —
   * moving the staff rows back to the top for an admin, or closing the gap for a member — fails
   * here even though every individual row is still present.
   */
  it("gives every role the document's own order — needs gates visibility, never the sequence", () => {
    const document = allItems();
    for (const role of USER_ROLES) {
      const visible = document
        .filter((item) => roleAdmits(item.needs, role))
        .map((item) => item.href);
      expect(hrefsFor(role), `role "${role}" is a re-sort of the document`).toEqual(visible);
      // And the groups a role sees are the document's groups, in the document's order.
      expect(menuFor(role).map((group) => group.label)).toEqual(
        ["group-admin", "group-app", "group-support"].filter((label) =>
          (ALIGN_MENU.find((group) => group.label === label)?.items ?? []).some((item) =>
            roleAdmits(item.needs, role),
          ),
        ),
      );
    }
  });

  it("gives a member the five rows that are theirs, and no staff row", () => {
    expect(MENUS.member).toEqual([...WORKSPACE, "/dashboard/help", "/dashboard/support"]);
    expect(MENUS.member.filter((href) => href.startsWith("/admin"))).toEqual([]);
  });

  /**
   * #620 — the Workspace group is **exactly three rows**, and the assertion is over the descriptor
   * rather than a screenshot: a menu is data, and the count is the thing the issues asked for. The
   * ids are the owner's words, so a row cannot be added back without naming it here — #877 added
   * `my-assessments` ("My Assessments"), immediately after the relationships it lists the sessions
   * of, and nothing else moved.
   */
  it("draws exactly three Workspace rows — My Relationships, My Assessments and Templates", () => {
    const workspace = ALIGN_MENU.find((group) => group.label === "group-app");
    expect(workspace?.items.map((item) => item.id)).toEqual([
      "my-relationships",
      "my-assessments",
      "templates",
    ]);
    expect(workspace?.items.map((item) => item.href)).toEqual([
      "/dashboard/relationships",
      "/assessments",
      "/dashboard/templates",
    ]);
  });

  /**
   * #929 — a support seat's rail opens on the operator group (where the one queue they work is the
   * only row they can reach), then the member's own work, then Support. The row moved from the end
   * of the menu to the front, and nothing around it was re-sorted.
   */
  it("gives a support seat the one queue it works, at the top of the document's order", () => {
    expect(MENUS.support).toEqual(["/admin/inbox", ...MENUS.member]);
    expect(menuFor("support").map((group) => group.label)).toEqual([
      "group-admin",
      "group-app",
      "group-support",
    ]);
  });

  it("gives an admin the operator group first, then the member's work, then Support", () => {
    expect(MENUS.admin).toEqual([...ADMIN_GROUP, ...WORKSPACE, ...SUPPORT_GROUP]);
    // The two admin-gated rows the owner moved into Support are drawn there, for an admin, with
    // the help pair — #929's arrangement, asserted rather than assumed.
    expect(MENUS.admin).toContain("/admin/review");
    expect(MENUS.admin).toContain("/admin/health");
    // #920's growth row and #901's docs row survived the move; nine rows in the operator group.
    expect(ADMIN_GROUP).toHaveLength(9);
  });

  /**
   * #901 — `/admin/docs` renders the 117-page manifest and had **no** rail row, so the whole tree
   * was reachable only by typing the address. The assertion is over both halves the defect needs:
   * the descriptor carries the row, and the rail actually draws it for an operator and for nobody
   * below one.
   */
  it("gives the docs home a row, for an operator and for nobody below one", () => {
    expect(hrefsFor("admin")).toContain("/admin/docs");
    expect(hrefsFor("owner")).toContain("/admin/docs");
    expect(hrefsFor("support")).not.toContain("/admin/docs");
    expect(railHrefs("admin")).toContain("/admin/docs");
    expect(railHrefs("member")).not.toContain("/admin/docs");
  });

  it("gives an owner everything an admin sees — the top rung is not a second list", () => {
    expect(MENUS.owner).toEqual(MENUS.admin);
    expect(MENUS.owner).toEqual(allItems().map((item) => item.href));
  });

  it("counts one more row per rung, in the ladder's own order", () => {
    const counts = USER_ROLES.map((role) => MENUS[role].length);
    // #920 added one operator row, so the two staff rungs carry 16 each.
    expect(counts).toEqual([5, 6, 16, 16]);
    // Not decoration: the first two rungs differ by exactly the row support exists for.
    expect(counts[1]).toBe(counts[0] + 1);
    expect(counts[2]).toBeGreaterThan(counts[1]);
  });

  it("shows a signed-out visitor the member menu, and never a staff row", () => {
    // `null` is nobody signed in. Every member row answers a signed-out request with
    // `redirect(/login?next=…)` — a working destination — so the reader is shown them and
    // nothing they would be refused.
    expect(hrefsFor(null)).toEqual(MENUS.member);
  });

  it("draws no group heading over no rows", () => {
    expect(menuFor("member").map((group) => group.label)).toEqual(["group-app", "group-support"]);
    // #929 — the operator group leads the document, so it is the first heading every staff rung
    // draws; a member's rail drops it entirely rather than drawing an empty Admin heading.
    for (const role of ["support", "admin", "owner"] as const) {
      expect(menuFor(role).map((group) => group.label)).toEqual([
        "group-admin",
        "group-app",
        "group-support",
      ]);
    }
  });
});

describe("the rendered rail", () => {
  it("renders the descriptor's rows for each role, in order", () => {
    for (const role of USER_ROLES) {
      expect(railHrefs(role)).toEqual(hrefsFor(role));
    }
  });

  /**
   * #929's claim, read off the markup rather than the descriptor: the **operator group is the
   * first thing an admin's rail draws**, and a member's rail opens on their own work because the
   * empty operator group is dropped instead of being re-sorted to the bottom.
   */
  it("draws the operator group first for an admin, and opens on the member's work for a member", () => {
    expect(railHrefs("admin")[0]).toBe("/admin/inbox");
    expect(railHrefs("owner")[0]).toBe("/admin/inbox");
    expect(railHrefs("support")[0]).toBe("/admin/inbox");
    expect(railHrefs("member")[0]).toBe("/dashboard/relationships");
    // The two staff rows inside Support are in the admin's markup, in the owner's order.
    const admin = railHrefs("admin");
    expect(admin.slice(-4)).toEqual([
      "/admin/review",
      "/dashboard/help",
      "/admin/health",
      "/dashboard/support",
    ]);
    expect(railHrefs("member")).not.toContain("/admin/review");
  });

  it("renders the console hub for an admin and an owner, and for nobody below them", () => {
    expect(railHrefs("admin")).toContain("/admin/console");
    expect(railHrefs("owner")).toContain("/admin/console");
    expect(railHrefs("support")).not.toContain("/admin/console");
    expect(railHrefs("member")).not.toContain("/admin/console");
    expect(railHrefs(null)).not.toContain("/admin/console");
  });

  it("does not leave an operator row in the markup for a member", () => {
    // The refusal is that a member does not learn the surface exists — so the words are absent
    // from the HTML, not `hidden` in a class a reader could still select.
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const html = railHtml("member");
    for (const id of ["console", "admin-instances", "admin-audit", "admin-inbox", "admin-health"]) {
      expect(html).not.toContain(`>${itemLabel(nav, id)}<`);
    }
  });

  it("marks the current page — and only the current page", () => {
    const activeOf = (pathname: string, role: UserRole = "member") =>
      [
        ...renderToStaticMarkup(
          createElement(AppNav, {
            brandId: "alignsynch",
            viewer: navViewer(role),
            copy: shellPageCopy,
            collapsed: false,
            pathname,
            onNavigate: () => undefined,
          }),
        ).matchAll(/<a\b[^>]*>/g),
      ]
        .map((match) => match[0])
        .filter((tag) => tag.includes("bg-nav-active"))
        .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "");

    // #620 removed the Overview row, so `/dashboard` lights nothing: the rail has no row it
    // could mark, and a rail that marked a row it does not draw would be the same bug mirrored.
    expect(activeOf("/dashboard")).toEqual([]);
    // A child page keeps its list row lit.
    expect(activeOf("/dashboard/relationships/abc")).toEqual(["/dashboard/relationships"]);
    expect(activeOf("/admin/console", "admin")).toEqual(["/admin/console"]);
  });
});

/**
 * #861 — the rows are a document (`data/nav-menu.json`), and the assertions that used to be about
 * an array in `lib/nav-menu.ts` are now about the file an operator edits. The two halves are
 * checked separately on purpose: this block proves the *document* is complete and honest (schema,
 * rung, route, label, hidden-with-reason), and the blocks above prove the *rail* draws it.
 */
describe("the document the rail is read from", () => {
  const rows = navDocument.groups.flatMap((group) => group.items) as unknown as NavRowRecord[];

  it("satisfies the schema in content/nav.ts — strict, so an unknown key is a failure", () => {
    const parsed = zNavDocument.safeParse(navDocument);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it("names the version this build reads", () => {
    expect(navDocument.version).toBe(NAV_DOCUMENT_VERSION);
  });

  it("draws exactly the document's rows, in the document's order", () => {
    // No row uses the explicit `order` key today: the order an editor reads is the order the rail
    // draws, which is the property the move must not lose.
    expect(rows.filter((row) => row.order !== undefined)).toEqual([]);
    expect(allItems().map((item) => item.href)).toEqual(
      rows.filter((row) => row.hidden !== true).map((row) => row.href),
    );
  });

  it("keeps every row — hidden ones included — pointed at a route, an icon and a real label", () => {
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const ids = new Set(nav.items?.map((item) => item.id) ?? []);
    for (const row of navDocument.groups.flatMap((group) => group.items) as NavRowRecord[]) {
      expect(matchRoute(routeManifest, row.href), `${row.href} is not a route`).toBeDefined();
      expect(NAV_ICON_NAMES, `${row.icon} is not an icon name`).toContain(row.icon);
      expect(ids.has(row.label ?? row.id), `${row.href} names "${row.label ?? row.id}"`).toBe(true);
      expect(USER_ROLES).toContain(row.needs);
    }
  });

  it("gives a hidden row a reason — `hidden` is not a role gate, so it has to say why", () => {
    for (const row of rows.filter((candidate) => candidate.hidden === true)) {
      expect((row.reason ?? "").trim(), `row "${row.id}" is hidden with no reason`).not.toBe("");
    }
  });
});
